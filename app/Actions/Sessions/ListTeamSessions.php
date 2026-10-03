<?php

namespace App\Actions\Sessions;

use App\Enums\RetroPhase;
use App\Enums\SessionState;
use App\Enums\TeamSurveyStatus;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Support\Sessions\SessionCursor;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Spec plan 22 §6.1. Five ordered queries, one per kind, each asked for one
 * row more than a page after the cursor; the merge in PHP keeps the same
 * order, so the first page of the merge is the first page of the union.
 * Also read by the team dashboard (TM-2) with a smaller limit.
 *
 * @phpstan-type SessionKind 'retro'|'poker'|'whiteboard'|'survey'|'icebreaker'
 * @phpstan-type TeamSession array{
 *     kind: SessionKind,
 *     id: string,
 *     title: string,
 *     url: string,
 *     state: string,
 *     updatedAt: string,
 *     isDraft: bool,
 *     phase: ?string,
 *     people: ?int,
 *     tasks: ?int,
 *     facilitator: ?string,
 *     answers: ?int,
 *     game: ?string
 * }
 */
class ListTeamSessions
{
    public const int PageSize = 20;

    public const int LiveWithinMinutes = 15;

    /**
     * @return array{
     *     sessions: list<TeamSession>,
     *     total: int,
     *     nextCursor: ?string
     * }
     */
    public function handle(Team $team, User $viewer, SessionState $state, ?SessionCursor $before = null, int $limit = self::PageSize): array
    {
        $kinds = [
            $this->read('retro', $this->retros($team, $state)->withCount('participants'), $before, $limit),
            $this->read('poker', $this->pokerGames($team, $state)->withCount('tasks'), $before, $limit),
            $this->read('survey', $this->surveys($team, $viewer, $state)->withCount([
                'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
            ]), $before, $limit),
            $this->read('whiteboard', $this->whiteboards($team, $state)->with('facilitator.user'), $before, $limit),
            $this->read('icebreaker', $this->rooms($team, $state), $before, $limit),
        ];

        $total = array_sum(array_column($kinds, 'total'));
        $rows = array_merge(...array_column($kinds, 'rows'));

        usort($rows, fn (array $first, array $second): int => $this->compare($first['model'], $second['model']));

        $kept = array_slice($rows, 0, $limit);
        $last = end($kept);

        return [
            'sessions' => array_map(fn (array $row): array => $this->present($row['kind'], $row['model'], $state), $kept),
            'total' => $total,
            'nextCursor' => count($rows) > $limit && $last !== false ? SessionCursor::after($last['model'])->toString() : null,
        ];
    }

    /**
     * One kind's total and its first rows after the cursor, one more than a
     * page. The count drops the columns `withCount` adds.
     *
     * @template TModel of Model
     *
     * @param  SessionKind  $kind
     * @param  Builder<TModel>  $query
     * @return array{
     *     total: int,
     *     rows: list<array{kind: SessionKind, model: Model}>
     * }
     */
    private function read(string $kind, Builder $query, ?SessionCursor $before, int $limit): array
    {
        $total = (clone $query)->count();

        $sessions = $this->after($query, $before)
            ->latest('updated_at')
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        return [
            'total' => $total,
            'rows' => array_values(array_map(fn (Model $session): array => ['kind' => $kind, 'model' => $session], $sessions->all())),
        ];
    }

    /**
     * Newer first, then the larger id first: the order of the queries.
     */
    private function compare(Model $first, Model $second): int
    {
        $byTime = $this->updatedAt($second) <=> $this->updatedAt($first);

        if ($byTime !== 0) {
            return $byTime;
        }

        return strcmp((string) $second->getKey(), (string) $first->getKey());
    }

    private function updatedAt(Model $session): CarbonImmutable
    {
        return CarbonImmutable::parse($session->getAttribute('updated_at'));
    }

    /**
     * The cursor is in UTC while `updated_at` is stored, without an offset, in
     * the application timezone: the bound instant is moved there first.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function after(Builder $query, ?SessionCursor $before): Builder
    {
        if ($before === null) {
            return $query;
        }

        $storedAt = $before->updatedAt->setTimezone(config('app.timezone'));

        return $query->where(fn (Builder $older) => $older
            ->where('updated_at', '<', $storedAt)
            ->orWhere(fn (Builder $same) => $same->where('updated_at', $storedAt)->where('id', '<', $before->id)));
    }

    /** @return Builder<Retro> */
    private function retros(Team $team, SessionState $state): Builder
    {
        $query = Retro::query()->where('team_id', $team->id);

        if ($state === SessionState::Finished) {
            return $query->where('phase', RetroPhase::Completed->value);
        }

        $open = $query->where('phase', '!=', RetroPhase::Completed->value);

        if ($state === SessionState::Upcoming) {
            return $open->whereNull('started_at')->whereDoesntHave('cards');
        }

        return $open->where(fn (Builder $begun) => $begun->whereNotNull('started_at')->orWhereHas('cards'));
    }

    /** @return Builder<PokerGame> */
    private function pokerGames(Team $team, SessionState $state): Builder
    {
        $query = PokerGame::query()->where('team_id', $team->id);

        return match ($state) {
            SessionState::Upcoming => $query->whereNull('ended_at')->whereDoesntHave('rounds'),
            SessionState::Live => $query->whereNull('ended_at')->whereHas('rounds'),
            SessionState::Finished => $query->whereNotNull('ended_at'),
        };
    }

    /** @return Builder<TeamSurvey> */
    private function surveys(Team $team, User $viewer, SessionState $state): Builder
    {
        $query = TeamSurvey::query()->where('team_id', $team->id)->whereNull('retro_id');

        return match ($state) {
            SessionState::Upcoming => $this->editableBy($query->where('status', TeamSurveyStatus::Draft->value), $team, $viewer),
            SessionState::Live => $query->where('status', TeamSurveyStatus::Open->value),
            SessionState::Finished => $query->where('status', TeamSurveyStatus::Closed->value),
        };
    }

    /**
     * A draft is listed to its editors only, as on the team page: the
     * workspace's managers and the poll's facilitator.
     *
     * @param  Builder<TeamSurvey>  $drafts
     * @return Builder<TeamSurvey>
     */
    private function editableBy(Builder $drafts, Team $team, User $viewer): Builder
    {
        if ($viewer->canManage($team->workspace)) {
            return $drafts;
        }

        return $drafts->whereHas('facilitator', fn (Builder $facilitator) => $facilitator->where('user_id', $viewer->id));
    }

    /** @return Builder<Whiteboard> */
    private function whiteboards(Team $team, SessionState $state): Builder
    {
        $query = Whiteboard::query()->where('team_id', $team->id);
        $recently = now()->subMinutes(self::LiveWithinMinutes);

        return match ($state) {
            SessionState::Upcoming => $query->whereDoesntHave('elements'),
            SessionState::Live => $query->whereHas('elements')->where('updated_at', '>=', $recently),
            SessionState::Finished => $query->whereHas('elements')->where('updated_at', '<', $recently),
        };
    }

    /** @return Builder<GameRoom> */
    private function rooms(Team $team, SessionState $state): Builder
    {
        $query = GameRoom::query()->where('team_id', $team->id)->whereNull('retro_id');

        return match ($state) {
            SessionState::Upcoming => $query->whereNull('current_round_id')->whereDoesntHave('rounds'),
            SessionState::Live => $query->whereNotNull('current_round_id'),
            SessionState::Finished => $query->whereNull('current_round_id')->whereHas('rounds'),
        };
    }

    /**
     * @param  SessionKind  $kind
     * @return TeamSession
     */
    private function present(string $kind, Model $session, SessionState $state): array
    {
        $row = [
            'kind' => $kind,
            'id' => (string) $session->getKey(),
            'title' => '',
            'url' => '',
            'state' => $state->value,
            'updatedAt' => $this->updatedAt($session)->utc()->toIso8601String(),
            'isDraft' => false,
            'phase' => null,
            'people' => null,
            'tasks' => null,
            'facilitator' => null,
            'answers' => null,
            'game' => null,
        ];

        return match (true) {
            $session instanceof Retro => [...$row, 'title' => $session->title, 'url' => route('retros.show', $session), 'phase' => $session->phase->label(), 'people' => (int) $session->getAttribute('participants_count')],
            $session instanceof PokerGame => [...$row, 'title' => $session->title, 'url' => route('poker.show', $session), 'tasks' => (int) $session->getAttribute('tasks_count')],
            $session instanceof TeamSurvey => [...$row, 'title' => $session->title, 'url' => $this->surveyUrl($session), 'isDraft' => $session->status === TeamSurveyStatus::Draft, 'answers' => (int) $session->getAttribute('responses_count')],
            $session instanceof Whiteboard => [...$row, 'title' => $session->title, 'url' => route('whiteboards.show', $session), 'facilitator' => $session->facilitator?->displayName()],
            $session instanceof GameRoom => [...$row, 'title' => (string) $session->name, 'url' => route('games.show', $session), 'game' => $session->game->label()],
            default => $row,
        };
    }

    /**
     * The rule of the team page: a draft opens its editor, any other poll its results.
     */
    private function surveyUrl(TeamSurvey $survey): string
    {
        if ($survey->status === TeamSurveyStatus::Draft) {
            return route('surveys.edit', $survey);
        }

        return route('surveys.results.show', $survey);
    }
}
