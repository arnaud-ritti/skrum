<?php

namespace App\Actions\Teams;

use App\Enums\TeamActivityKind;
use App\Models\ActionItem;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamActivity;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use App\Support\Sessions\SessionCursor;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection as BaseCollection;

/**
 * @phpstan-type ActivityLine array{
 *     id: string,
 *     kind: string,
 *     actor: array{name: string, avatarUrl: ?string},
 *     subject: array{title: string, url: ?string}|null,
 *     at: string,
 *     day: string
 * }
 */
class ListTeamActivity
{
    public const int HomeLimit = 5;

    public const int PageSize = 30;

    /** The kinds each chip of the Activity page keeps. */
    public const array Groups = [
        'sessions' => [
            TeamActivityKind::RetroStarted,
            TeamActivityKind::RetroCompleted,
            TeamActivityKind::PokerStarted,
            TeamActivityKind::PokerEnded,
            TeamActivityKind::WhiteboardCreated,
            TeamActivityKind::SurveyPublished,
            TeamActivityKind::SurveyClosed,
        ],
        'actions' => [TeamActivityKind::ActionItemCompleted],
        'members' => [TeamActivityKind::MemberJoined],
    ];

    /**
     * @return list<ActivityLine>
     */
    public function handle(Team $team, int $limit = self::HomeLimit): array
    {
        return $this->present($team, $this->newestFirst($team->activities()->getQuery())->limit($limit)->get());
    }

    /**
     * One page of the lines under the filters, newest first. A guest's line has no member and matches no actor.
     * `$day` is a day of the application's time zone, the zone `created_at` is stored in.
     *
     * @param  key-of<self::Groups>|null  $group
     * @return array{
     *     lines: list<ActivityLine>,
     *     total: int,
     *     nextCursor: ?string
     * }
     */
    public function page(Team $team, ?string $group = null, ?string $actorId = null, ?CarbonImmutable $day = null, ?string $before = null, int $limit = self::PageSize): array
    {
        $query = $team->activities()->getQuery();

        if ($group !== null) {
            $query->whereIn('kind', array_column(self::Groups[$group], 'value'));
        }

        if ($actorId !== null) {
            $query->where('actor_user_id', $actorId);
        }

        if ($day !== null) {
            $start = $day->setTimezone((string) config('app.timezone'))->startOfDay();

            $query->where('created_at', '>=', $start)->where('created_at', '<', $start->addDay());
        }

        $total = (clone $query)->count();
        $activities = $this->newestFirst($this->after($query, SessionCursor::parse($before)))->limit($limit + 1)->get();
        $kept = $activities->take($limit);
        $last = $kept->last();

        return [
            'lines' => $this->present($team, $kept),
            'total' => $total,
            'nextCursor' => $activities->count() > $limit && $last !== null ? SessionCursor::afterCreated($last)->toString() : null,
        ];
    }

    /**
     * @param  Builder<TeamActivity>  $query
     * @return Builder<TeamActivity>
     */
    private function newestFirst(Builder $query): Builder
    {
        return $query->with('actor')->latest()->orderByDesc('id');
    }

    /**
     * The cursor is in UTC while `created_at` is stored, without an offset, in
     * the application timezone: the bound instant is moved there first.
     *
     * @param  Builder<TeamActivity>  $query
     * @return Builder<TeamActivity>
     */
    private function after(Builder $query, ?SessionCursor $before): Builder
    {
        if ($before === null) {
            return $query;
        }

        $storedAt = $before->updatedAt->setTimezone((string) config('app.timezone'));

        return $query->where(fn (Builder $older) => $older
            ->where('created_at', '<', $storedAt)
            ->orWhere(fn (Builder $same) => $same->where('created_at', $storedAt)->where('id', '<', $before->id)));
    }

    /**
     * @param  Collection<int, TeamActivity>  $activities
     * @return list<ActivityLine>
     */
    private function present(Team $team, Collection $activities): array
    {
        $existing = $this->existingSubjects($activities);

        return array_values($activities->map(fn (TeamActivity $activity): array => [
            'id' => $activity->id,
            'kind' => $activity->kind->value,
            'actor' => $this->actor($activity),
            'subject' => $activity->subject_title === null ? null : [
                'title' => $activity->subject_title,
                'url' => $existing->contains($activity->subject_id) ? $this->url($team, $activity) : null,
            ],
            'at' => (string) $activity->created_at?->toIso8601String(),
            'day' => (string) $activity->created_at?->toImmutable()->setTimezone((string) config('app.timezone'))->toDateString(),
        ])->all());
    }

    /**
     * A deleted account leaves its lines with no actor: they read "Former member".
     *
     * @return array{name: string, avatarUrl: ?string}
     */
    private function actor(TeamActivity $activity): array
    {
        if ($activity->actor_user_id === null) {
            return ['name' => $activity->actor_name ?? __('Former member'), 'avatarUrl' => null];
        }

        return ['name' => $activity->actor->name, 'avatarUrl' => $activity->actor->avatarUrl()];
    }

    /**
     * The subjects of these lines that still exist, at most one query per kind of subject.
     *
     * @param  Collection<int, TeamActivity>  $activities
     * @return BaseCollection<array-key, mixed>
     */
    private function existingSubjects(Collection $activities): BaseCollection
    {
        $idsOf = fn (TeamActivityKind ...$kinds): array => $activities
            ->filter(fn (TeamActivity $activity): bool => in_array($activity->kind, $kinds, true) && $activity->subject_id !== null)
            ->pluck('subject_id')
            ->all();

        return collect()
            ->concat($this->existingIds(Retro::query(), $idsOf(TeamActivityKind::RetroStarted, TeamActivityKind::RetroCompleted)))
            ->concat($this->existingIds(PokerGame::query(), $idsOf(TeamActivityKind::PokerStarted, TeamActivityKind::PokerEnded)))
            ->concat($this->existingIds(Whiteboard::query(), $idsOf(TeamActivityKind::WhiteboardCreated)))
            ->concat($this->existingIds(TeamSurvey::query(), $idsOf(TeamActivityKind::SurveyPublished, TeamActivityKind::SurveyClosed)))
            ->concat($this->existingIds(ActionItem::query(), $idsOf(TeamActivityKind::ActionItemCompleted)));
    }

    /**
     * @param  Builder<covariant Model>  $query
     * @param  array<int, string>  $ids
     * @return BaseCollection<array-key, mixed>
     */
    private function existingIds(Builder $query, array $ids): BaseCollection
    {
        if ($ids === []) {
            return collect();
        }

        return $query->whereIn('id', $ids)->pluck('id');
    }

    private function url(Team $team, TeamActivity $activity): ?string
    {
        $id = (string) $activity->subject_id;

        return match ($activity->kind) {
            TeamActivityKind::RetroStarted, TeamActivityKind::RetroCompleted => route('retros.show', $id),
            TeamActivityKind::PokerStarted, TeamActivityKind::PokerEnded => route('poker.show', $id),
            TeamActivityKind::WhiteboardCreated => route('whiteboards.show', $id),
            TeamActivityKind::SurveyPublished => route('surveys.show', $id),
            TeamActivityKind::SurveyClosed => route('surveys.results.show', $id),
            TeamActivityKind::ActionItemCompleted => route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'team' => $team->id]),
            TeamActivityKind::MemberJoined => null,
        };
    }
}
