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
 *     at: string
 * }
 */
class ListTeamActivity
{
    public const int Limit = 10;

    /**
     * @return array<int, ActivityLine>
     */
    public function handle(Team $team): array
    {
        $activities = $team->activities()
            ->with('actor')
            ->latest()
            ->orderByDesc('id')
            ->limit(self::Limit)
            ->get();

        $existing = $this->existingSubjects($activities);

        return $activities->map(fn (TeamActivity $activity): array => [
            'id' => $activity->id,
            'kind' => $activity->kind->value,
            'actor' => $this->actor($activity),
            'subject' => $activity->subject_title === null ? null : [
                'title' => $activity->subject_title,
                'url' => $existing->contains($activity->subject_id) ? $this->url($team, $activity) : null,
            ],
            'at' => (string) $activity->created_at?->toIso8601String(),
        ])->values()->all();
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
