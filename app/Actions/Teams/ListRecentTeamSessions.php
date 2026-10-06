<?php

namespace App\Actions\Teams;

use App\Actions\Sessions\ListTeamSessions;
use App\Enums\SessionState;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * What the team page shows of the team's sessions: the live ones apart, then the latest others.
 * Each state of each kind is read with the query of the Sessions page
 * (`ListTeamSessions`), so a row's state is that page's state.
 *
 * @phpstan-type RecentTeamSession array{
 *     kind: string,
 *     id: string,
 *     title: string,
 *     url: string,
 *     state: string,
 *     updatedAt: string,
 *     participants: int,
 *     meta: array<string, int|string|null>,
 *     outcome: array{kind: string, count: int}|null,
 *     roti: ?float
 * }
 */
class ListRecentTeamSessions
{
    public const int Limit = 5;

    public function __construct(private ListTeamSessions $sessions) {}

    /**
     * Both lists newest first; `recent` holds no live session and at most `Limit` rows.
     *
     * @return array{
     *     live: list<RecentTeamSession>,
     *     recent: list<RecentTeamSession>
     * }
     */
    public function handle(Team $team, User $viewer): array
    {
        $rows = [];

        foreach (SessionState::cases() as $state) {
            $rows = [
                ...$rows,
                ...$this->latest($this->sessions->retros($team, $state)->withCount(['participants', 'cards', 'actionItems'])->withAvg('rotiVotes', 'score'), $state),
                ...$this->latest($this->sessions->pokerGames($team, $state)->withCount([
                    'tasks',
                    'tasks as estimated_tasks_count' => fn (Builder $tasks) => $tasks->whereNotNull('estimated_at'),
                    'players' => fn (Builder $players) => $players->where('is_spectator', false),
                ]), $state),
                ...$this->latest($this->sessions->whiteboards($team, $state)->with('facilitator.user')->withCount('members'), $state),
                ...$this->latest($this->sessions->surveys($team, $viewer, $state)->withCount([
                    'questions',
                    'respondents as responses_count' => fn (Builder $respondents) => $respondents->whereHas('answers'),
                ]), $state),
                ...$this->latest($this->sessions->rooms($team, $state)->withCount('players'), $state),
            ];
        }

        usort($rows, fn (array $first, array $second): int => [$second['updatedAt'], $second['id']] <=> [$first['updatedAt'], $first['id']]);

        $isLive = fn (array $row): bool => $row['state'] === SessionState::Live->value;

        return [
            'live' => array_values(array_filter($rows, $isLive)),
            'recent' => array_slice(array_values(array_filter($rows, fn (array $row): bool => ! $isLive($row))), 0, self::Limit),
        ];
    }

    /**
     * One state of one kind: its latest rows, at most a page of this list, or every live one
     * up to the bound of the Sessions page.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return list<RecentTeamSession>
     */
    private function latest(Builder $query, SessionState $state): array
    {
        $limit = $state === SessionState::Live ? ListTeamSessions::LiveLimit : self::Limit;
        $sessions = $query->latest('updated_at')->orderByDesc('id')->limit($limit)->get();

        return array_values(array_map(fn (Model $session): array => $this->present($session, $state), $sessions->all()));
    }

    /**
     * @return RecentTeamSession
     */
    private function present(Model $session, SessionState $state): array
    {
        $row = [
            'kind' => '',
            'id' => (string) $session->getKey(),
            'title' => '',
            'url' => '',
            'state' => $state->value,
            'updatedAt' => CarbonImmutable::parse($session->getAttribute('updated_at'))->utc()->toIso8601String(),
            'participants' => 0,
            'meta' => [],
            'outcome' => null,
            'roti' => null,
        ];
        $finished = $state === SessionState::Finished;

        return match (true) {
            $session instanceof Retro => [
                ...$row,
                'kind' => 'retro',
                'title' => $session->title,
                'url' => route('retros.show', $session),
                'participants' => (int) $session->getAttribute('participants_count'),
                'meta' => ['phaseLabel' => $session->phase->label(), 'cards' => (int) $session->getAttribute('cards_count')],
                'outcome' => $finished ? ['kind' => 'actions', 'count' => (int) $session->getAttribute('action_items_count')] : null,
                'roti' => $finished && $session->roti_votes_avg_score !== null ? round((float) $session->roti_votes_avg_score, 1) : null,
            ],
            $session instanceof PokerGame => [
                ...$row,
                'kind' => 'poker',
                'title' => $session->title,
                'url' => route('poker.show', $session),
                'participants' => (int) $session->getAttribute('players_count'),
                'meta' => ['tasks' => (int) $session->getAttribute('tasks_count')],
                'outcome' => $finished ? ['kind' => 'estimated', 'count' => (int) $session->getAttribute('estimated_tasks_count')] : null,
            ],
            $session instanceof Whiteboard => [
                ...$row,
                'kind' => 'whiteboard',
                'title' => $session->title,
                'url' => route('whiteboards.show', $session),
                'participants' => (int) $session->getAttribute('members_count'),
                'meta' => ['facilitatorName' => $session->facilitator?->displayName()],
            ],
            $session instanceof TeamSurvey => [
                ...$row,
                'kind' => 'survey',
                'title' => $session->title,
                'url' => $session->url(),
                'participants' => (int) $session->getAttribute('responses_count'),
                'meta' => ['questions' => (int) $session->getAttribute('questions_count')],
                'outcome' => $finished ? ['kind' => 'answers', 'count' => (int) $session->getAttribute('responses_count')] : null,
            ],
            $session instanceof GameRoom => [
                ...$row,
                'kind' => 'game',
                'title' => (string) $session->name,
                'url' => route('games.show', $session),
                'participants' => (int) $session->getAttribute('players_count'),
                'meta' => ['gameLabel' => $session->game->label()],
            ],
            default => $row,
        };
    }
}
