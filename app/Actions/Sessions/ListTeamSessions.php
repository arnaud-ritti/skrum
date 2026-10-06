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
use App\Support\Database\SearchText;
use App\Support\Sessions\SessionCursor;
use App\Support\Teams\SprintCalendar;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * The sessions of a team, every kind in one list. Five ordered queries, one per kind, each asked for one
 * row more than a page after the cursor; the merge in PHP keeps the same
 * order, so the first page of the merge is the first page of the union.
 * The five per-kind queries are public: the team page's recent sessions
 * (TM-2, ListRecentTeamSessions) reads each state with the same rules.
 * The six optional fields of a row are those `timeline()` adds.
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
 *     game: ?string,
 *     sprint?: array{number: int, startsOn: string, endsOn: string}|null,
 *     roti?: ?float,
 *     actions?: ?int,
 *     points?: ?float,
 *     canDelete?: bool,
 *     canDuplicate?: bool
 * }
 */
class ListTeamSessions
{
    public const int PageSize = 20;

    public const int LiveWithinMinutes = 15;

    public const array Kinds = ['retro', 'poker', 'survey', 'whiteboard', 'icebreaker'];

    public const int LiveLimit = 100;

    /** What players write in a round without writing the round: the relation of GameRound, and the column that dates a row. */
    private const array RoundWrites = [
        'gifAnswers' => 'updated_at',
        'gifVotes' => 'updated_at',
        'choices' => 'updated_at',
        'textAnswers' => 'updated_at',
        'guesses' => 'created_at',
    ];

    /**
     * @return array{
     *     sessions: list<TeamSession>,
     *     total: int,
     *     nextCursor: ?string
     * }
     */
    public function handle(Team $team, User $viewer, SessionState $state, ?SessionCursor $before = null, int $limit = self::PageSize, ?string $search = null): array
    {
        $kinds = [
            $this->read('retro', $this->titled($this->retros($team, $state), 'title', $search)->withCount('participants'), $before, $limit),
            $this->read('poker', $this->titled($this->pokerGames($team, $state), 'title', $search)->withCount('tasks'), $before, $limit),
            $this->read('survey', $this->surveysTitled($this->surveys($team, $viewer, $state), $search)->withCount([
                'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
            ]), $before, $limit),
            $this->read('whiteboard', $this->titled($this->whiteboards($team, $state), 'title', $search)->with('facilitator.user'), $before, $limit),
            $this->read('icebreaker', $this->titled($this->rooms($team, $state), 'name', $search), $before, $limit),
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
     * The live sessions apart, then every other session, upcoming and finished together, paged by the cursor.
     * The counts hold the live sessions and ignore the kind asked for.
     * ponytail: a team with more than 100 live sessions sees the newest 100, page the live block if one ever does.
     *
     * @param  SessionKind|null  $kind
     * @return array{
     *     live: list<TeamSession>,
     *     sessions: list<TeamSession>,
     *     counts: array{all: int, retro: int, poker: int, survey: int, whiteboard: int, icebreaker: int},
     *     total: int,
     *     nextCursor: ?string
     * }
     */
    public function timeline(Team $team, User $viewer, ?string $kind = null, ?SessionCursor $before = null, int $limit = self::PageSize, ?string $search = null): array
    {
        $counts = array_fill_keys(self::Kinds, 0);
        $live = [];
        $past = [];
        $total = 0;

        foreach (self::Kinds as $each) {
            foreach (SessionState::cases() as $state) {
                $query = $this->kindQuery($each, $team, $viewer, $state, $search);

                if ($kind !== null && $kind !== $each) {
                    $counts[$each] += $query->count();

                    continue;
                }

                $isLive = $state === SessionState::Live;
                $read = $this->read($each, $query, $isLive ? null : $before, $isLive ? self::LiveLimit : $limit);
                $rows = array_map(fn (array $row): array => [...$row, 'state' => $state], $read['rows']);
                $counts[$each] += $read['total'];

                if ($isLive) {
                    $live = [...$live, ...$rows];

                    continue;
                }

                $past = [...$past, ...$rows];
                $total += $read['total'];
            }
        }

        $newestFirst = fn (array $first, array $second): int => $this->compare($first['model'], $second['model']);
        usort($live, $newestFirst);
        usort($past, $newestFirst);

        $live = array_slice($live, 0, self::LiveLimit);
        $kept = array_slice($past, 0, $limit);
        $last = end($kept);
        $calendar = $this->calendarOf($team, [...$live, ...$kept]);
        $viewerManagesWorkspace = $viewer->canManage($team->workspace);
        $viewerMayCreateSurvey = $viewer->can('createSurvey', $team);
        $present = fn (array $row): array => [
            ...$this->presentInTimeline($row['kind'], $row['model'], $row['state'], $calendar),
            'canDelete' => $this->mayDelete($row['model'], $viewer, $viewerManagesWorkspace),
            'canDuplicate' => $viewerMayCreateSurvey && $row['model'] instanceof TeamSurvey,
        ];

        return [
            'live' => array_map($present, $live),
            'sessions' => array_map($present, $kept),
            'counts' => ['all' => array_sum($counts), ...$counts],
            'total' => $total,
            'nextCursor' => count($past) > $limit && $last !== false ? SessionCursor::after($last['model'])->toString() : null,
        ];
    }

    /**
     * One state of one kind, with what a row of the timeline shows of it.
     *
     * @param  SessionKind  $kind
     * @return Builder<covariant Model>
     */
    private function kindQuery(string $kind, Team $team, User $viewer, SessionState $state, ?string $search): Builder
    {
        return match ($kind) {
            'retro' => $this->titled($this->retros($team, $state), 'title', $search)
                ->withCount(['participants', 'actionItems'])
                ->withAvg('rotiVotes', 'score'),
            'poker' => $this->titled($this->pokerGames($team, $state), 'title', $search)
                ->withCount('tasks')
                ->withSum('tasks as total_points', 'estimate_numeric'),
            'survey' => $this->surveysTitled($this->surveys($team, $viewer, $state), $search)
                ->with('facilitator')
                ->withCount(['respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers')]),
            'whiteboard' => $this->titled($this->whiteboards($team, $state), 'title', $search)->with('facilitator.user'),
            'icebreaker' => $this->titled($this->rooms($team, $state), 'name', $search)->withCount('players'),
        };
    }

    /**
     * The sprints that cover the rows shown; none when there is no row. A row's sprint is here the one of
     * its last change, not of its creation: the last change is the sort key, so paging never cuts a group.
     *
     * @param  list<array{model: Model}>  $rows
     */
    private function calendarOf(Team $team, array $rows): ?SprintCalendar
    {
        if ($rows === []) {
            return null;
        }

        $moments = array_map(fn (array $row): CarbonImmutable => $this->updatedAt($row['model']), $rows);

        return SprintCalendar::forTeam($team, min($moments), max($moments));
    }

    /**
     * @param  SessionKind  $kind
     * @return TeamSession
     */
    private function presentInTimeline(string $kind, Model $session, SessionState $state, ?SprintCalendar $calendar): array
    {
        $row = $this->present($kind, $session, $state);
        $sprint = $calendar?->sprintOn($this->updatedAt($session));
        $roti = $session->getAttribute('roti_votes_avg_score');
        $points = $session->getAttribute('total_points');

        return [
            ...$row,
            'sprint' => $sprint === null ? null : ['number' => $sprint['number'], 'startsOn' => $sprint['startsOn'], 'endsOn' => $sprint['endsOn']],
            'people' => $session instanceof GameRoom ? (int) $session->getAttribute('players_count') : $row['people'],
            'roti' => $roti === null ? null : round((float) $roti, 1),
            'actions' => $session instanceof Retro ? (int) $session->getAttribute('action_items_count') : null,
            'points' => $points === null ? null : (float) $points,
        ];
    }

    /**
     * A board or a poll is deleted by its facilitator or a manager of the workspace, the rule of their own
     * pages; no other kind is deleted from a list.
     */
    private function mayDelete(Model $session, User $viewer, bool $viewerManagesWorkspace): bool
    {
        if (! $session instanceof Whiteboard && ! $session instanceof TeamSurvey) {
            return false;
        }

        return $viewerManagesWorkspace || $session->facilitator?->user_id === $viewer->id;
    }

    /**
     * One kind's total and its first rows after the cursor, one more than a
     * page. The count drops the columns `withCount` adds.
     *
     * @param  SessionKind  $kind
     * @param  Builder<covariant Model>  $query
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
     * The sessions whose folded title holds the search (docs/database.md rule 4).
     *
     * @template TModel of Retro|PokerGame|Whiteboard|GameRoom
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function titled(Builder $query, string $column, ?string $search): Builder
    {
        if ($search === null) {
            return $query;
        }

        return $query->whereContains($column, $search);
    }

    /**
     * Polls have no folded title column: their titles are matched in PHP,
     * and SQL then pages the ids kept.
     * ponytail: reads every title of the team's polls in the tab, add a `title_search` column if a team holds thousands.
     *
     * @param  Builder<TeamSurvey>  $query
     * @return Builder<TeamSurvey>
     */
    private function surveysTitled(Builder $query, ?string $search): Builder
    {
        if ($search === null) {
            return $query;
        }

        $kept = (clone $query)->get(['id', 'title'])
            ->filter(fn (TeamSurvey $survey): bool => SearchText::contains($survey->title, $search))
            ->modelKeys();

        return $query->whereKey($kept);
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
     * @param  Builder<covariant Model>  $query
     * @return Builder<covariant Model>
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
    public function retros(Team $team, SessionState $state): Builder
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
    public function pokerGames(Team $team, SessionState $state): Builder
    {
        $query = PokerGame::query()->where('team_id', $team->id);

        return match ($state) {
            SessionState::Upcoming => $query->whereNull('ended_at')->whereDoesntHave('rounds'),
            SessionState::Live => $query->whereNull('ended_at')->whereHas('rounds'),
            SessionState::Finished => $query->whereNotNull('ended_at'),
        };
    }

    /** @return Builder<TeamSurvey> */
    public function surveys(Team $team, User $viewer, SessionState $state): Builder
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
    public function whiteboards(Team $team, SessionState $state): Builder
    {
        $query = Whiteboard::query()->where('team_id', $team->id);
        $recently = now()->subMinutes(self::LiveWithinMinutes);

        return match ($state) {
            SessionState::Upcoming => $query->whereDoesntHave('elements'),
            SessionState::Live => $query->whereHas('elements')->where('updated_at', '>=', $recently),
            SessionState::Finished => $query->whereHas('elements')->where('updated_at', '<', $recently),
        };
    }

    /**
     * Nothing clears a room's current round, so a round alone does not make a room live: something must have
     * happened in it lately. Starting and ending a round write the room, playing one writes the round, and an
     * answer, a vote or a guess writes only its own row.
     *
     * @return Builder<GameRoom>
     */
    public function rooms(Team $team, SessionState $state): Builder
    {
        $query = GameRoom::query()->where('team_id', $team->id)->whereNull('retro_id');
        $recently = now()->subMinutes(self::LiveWithinMinutes);
        $playedRecently = fn (Builder $round) => $round->where(function (Builder $played) use ($recently): void {
            $played->where('updated_at', '>=', $recently);

            foreach (self::RoundWrites as $relation => $writtenAt) {
                $played->orWhereHas($relation, fn (Builder $written) => $written->where($writtenAt, '>=', $recently));
            }
        });

        return match ($state) {
            SessionState::Upcoming => $query->whereNull('current_round_id')->whereDoesntHave('rounds'),
            SessionState::Live => $query->whereNotNull('current_round_id')->where(fn (Builder $active) => $active
                ->where('updated_at', '>=', $recently)
                ->orWhereHas('currentRound', $playedRecently)),
            SessionState::Finished => $query->whereHas('rounds')->where(fn (Builder $over) => $over
                ->whereNull('current_round_id')
                ->orWhere(fn (Builder $quiet) => $quiet
                    ->where('updated_at', '<', $recently)
                    ->whereDoesntHave('currentRound', $playedRecently))),
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
            $session instanceof TeamSurvey => [...$row, 'title' => $session->title, 'url' => $session->url(), 'isDraft' => $session->status === TeamSurveyStatus::Draft, 'answers' => (int) $session->getAttribute('responses_count')],
            $session instanceof Whiteboard => [...$row, 'title' => $session->title, 'url' => route('whiteboards.show', $session), 'facilitator' => $session->facilitator?->displayName()],
            $session instanceof GameRoom => [...$row, 'title' => (string) $session->name, 'url' => route('games.show', $session), 'game' => $session->game->label()],
            default => $row,
        };
    }
}
