<?php

namespace App\Mcp\Presenters;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\PresentPokerTask;
use App\Mcp\McpGrant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;

/**
 * Poker payloads for MCP, always derived from the game's own presenters so
 * spec 4's redaction (unrevealed and anonymous values) holds unchanged.
 *
 * @phpstan-import-type Snapshot from BuildPokerSnapshot
 */
class McpPokerGame
{
    public function __construct(
        private BuildPokerSnapshot $buildPokerSnapshot,
        private PresentPokerRound $presentPokerRound,
        private PresentPokerTask $presentPokerTask,
    ) {}

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     deck: string,
     *     tasksCount: int,
     *     estimatedCount: int,
     *     totalPoints: ?float,
     *     endedAt: ?string,
     *     createdAt: string,
     *     url: string
     * }
     */
    public function summary(PokerGame $game): array
    {
        return [
            'id' => $game->id,
            'title' => $game->title,
            'deck' => $game->deck->value,
            'tasksCount' => (int) $game->getAttribute('tasks_count'),
            'estimatedCount' => (int) $game->getAttribute('estimated_tasks_count'),
            'totalPoints' => $game->isNumeric() ? round((float) $game->getAttribute('total_points'), 2) : null,
            'endedAt' => $game->ended_at?->toIso8601String(),
            'createdAt' => $game->created_at?->toIso8601String() ?? '',
            'url' => route('poker.show', $game),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function game(PokerGame $game, ?PokerPlayer $viewer): array
    {
        $snapshot = $this->buildPokerSnapshot->handle($game, $viewer ?? $this->onlooker($game));
        $facilitator = collect($snapshot['players'])->firstWhere('id', $game->facilitator_player_id);

        return [
            'game' => [
                'id' => $game->id,
                'title' => $game->title,
                'deck' => $snapshot['game']['deck'],
                'deckLabel' => $snapshot['game']['deckLabel'],
                'cards' => $snapshot['game']['cards'],
                'isNumeric' => $snapshot['game']['isNumeric'],
                'autoReveal' => $snapshot['game']['autoReveal'],
                'anonymousVotes' => $snapshot['game']['anonymousVotes'],
                'endedAt' => $snapshot['game']['endedAt'],
                'tasksCount' => $snapshot['game']['tasksCount'],
                'estimatedCount' => $snapshot['game']['estimatedCount'],
                'totalPoints' => $snapshot['game']['totalPoints'],
                'url' => route('poker.show', $game),
                'guestJoinUrl' => $snapshot['game']['guestUrl'],
            ],
            'facilitator' => $facilitator === null ? null : ['name' => $facilitator['name']],
            'players' => collect($snapshot['players'])->map(fn (array $player): array => [
                'name' => $player['name'],
                'avatarUrl' => $player['avatarUrl'] === null ? null : url($player['avatarUrl']),
                'isGuest' => $player['isGuest'],
                'isSpectator' => $player['isSpectator'],
            ])->values()->all(),
            'currentTask' => $this->currentTask($snapshot),
            'me' => [
                'isPlayer' => $viewer !== null,
                'isFacilitator' => $viewer !== null && $game->isFacilitator($viewer),
                'isSpectator' => $viewer !== null && $viewer->is_spectator,
                'canEditTasks' => ! $game->isEnded() && ! ($viewer?->isGuest() ?? false),
            ],
        ];
    }

    /**
     * @param  Snapshot  $snapshot
     * @return ?array<string, mixed>
     */
    public function currentTask(array $snapshot): ?array
    {
        if ($snapshot['current'] === null) {
            return null;
        }

        $round = $snapshot['current']['round'];
        $task = collect($snapshot['tasks'])->firstWhere('id', $snapshot['current']['taskId']);
        $voterIds = collect($round['votes'])->pluck('playerId')->flip();

        return [
            'id' => $snapshot['current']['taskId'],
            'title' => $task['title'] ?? '',
            'round' => [
                'number' => $round['number'],
                'anonymous' => $round['anonymous'],
                'revealed' => $round['revealedAt'] !== null,
                'revealReason' => $round['revealReason'],
                'timerEndsAt' => $round['timerEndsAt'],
                'votesCount' => $round['votesCount'],
                'voters' => collect($snapshot['players'])
                    ->reject(fn (array $player): bool => $player['isSpectator'])
                    ->map(fn (array $player): array => ['name' => $player['name'], 'hasVoted' => $voterIds->has($player['id'])])
                    ->values()
                    ->all(),
                'myVote' => $round['myVote'],
                'result' => $round['result'],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function tasks(PokerGame $game, ?PokerPlayer $viewer): array
    {
        $game->load([
            'players.user',
            'tasks' => fn ($query) => $query->withCount('rounds'),
            'tasks.latestRound.votes',
        ]);

        $names = $game->players->mapWithKeys(fn (PokerPlayer $player): array => [$player->id => $player->displayName()]);

        $sync = PokerTaskSync::for($game);

        return $game->tasks->map(function (PokerTask $task) use ($game, $viewer, $names, $sync): array {
            $presented = $this->presentPokerTask->handle($task, $sync);
            $round = $task->latestRound;
            $latest = $round === null ? null : $this->presentPokerRound->handle($round, $game, $viewer?->id);

            return [
                'id' => $task->id,
                'title' => $presented['title'],
                'description' => $presented['description'],
                'position' => $presented['position'],
                'isCurrent' => $game->current_task_id === $task->id,
                'estimate' => $presented['estimate'],
                'estimatedAt' => $presented['estimatedAt'],
                'roundsCount' => $presented['roundsCount'],
                'latestRound' => $latest === null ? null : [
                    'number' => $latest['number'],
                    'anonymous' => $latest['anonymous'],
                    'revealed' => $latest['revealedAt'] !== null,
                    'revealReason' => $latest['revealReason'],
                    'votes' => collect($latest['votes'])->map(fn (array $vote): array => [
                        'player' => $names[$vote['playerId']] ?? __('Former member'),
                        'value' => $vote['value'],
                    ])->all(),
                    'result' => $latest['result'],
                ],
                'external' => $presented['external'] === null ? null : [
                    'source' => $presented['external']['source'],
                    'key' => $presented['external']['key'],
                    'url' => $presented['external']['url'],
                    'syncState' => $presented['external']['syncState'] ?? null,
                    'syncError' => $presented['external']['syncError'] ?? null,
                    'statusCategory' => $presented['external']['statusCategory'] ?? null,
                    'missing' => $presented['external']['missing'] ?? false,
                    'estimateConflict' => $presented['external']['estimateConflict'] ?? null,
                ],
            ];
        })->values()->all();
    }

    /**
     * A team member who never joined reads the game as an unsaved player:
     * no own vote, nothing created.
     */
    private function onlooker(PokerGame $game): PokerPlayer
    {
        $onlooker = new PokerPlayer(['poker_game_id' => $game->id, 'user_id' => McpGrant::current()->user->id]);
        $onlooker->setRelation('user', McpGrant::current()->user);

        return $onlooker;
    }
}
