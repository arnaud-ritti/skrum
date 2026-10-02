<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\ShareOptions;
use App\Actions\Integrations\SharePermissions;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Contracts\Database\Query\Builder;

/**
 * @phpstan-import-type Delivery from PresentIntegrationDelivery
 * @phpstan-import-type Round from PresentPokerRound
 * @phpstan-import-type Task from PresentPokerTask
 *
 * @phpstan-type Snapshot array{
 *     game: array{
 *         id: string,
 *         title: string,
 *         deck: string,
 *         deckLabel: string,
 *         cards: array<int, string>,
 *         isNumeric: bool,
 *         facilitatorPlayerId: ?string,
 *         guestAccessEnabled: bool,
 *         guestUrl: ?string,
 *         endedAt: ?string,
 *         currentTaskId: ?string,
 *         tasksCount: int,
 *         estimatedCount: int,
 *         totalPoints: ?float,
 *         hasVotes: bool,
 *         autoReveal: bool,
 *         anonymousVotes: bool,
 *         cursorsEnabled: bool,
 *         reactionsEnabled: bool,
 *         teamName: ?string
 *     },
 *     me: array{
 *         playerId: string,
 *         userId: ?string,
 *         isGuest: bool,
 *         isFacilitator: bool,
 *         isSpectator: bool,
 *         canVote: bool,
 *         canEditTasks: bool,
 *         canTakeControl: bool,
 *         canDelete: bool,
 *         transferCandidates: array<int, array{userId: string, name: string}>
 *     },
 *     players: array<int, array{id: string, name: string, avatarUrl: ?string, isGuest: bool, isSpectator: bool}>,
 *     tasks: array<int, Task>,
 *     current: ?array{taskId: string, round: Round},
 *     team: ?array{id: string, workspace: string},
 *     links: array{team: ?string},
 *     integrations: ?array<string, array{connected: bool, canWrite: bool}|null>,
 *     share: array{slack: bool, telegram: bool},
 *     deliveries: array<int, Delivery>,
 *     serverTime: string
 * }
 */
class BuildPokerSnapshot
{
    public function __construct(
        private PresentPokerRound $presentPokerRound,
        private PresentPokerTask $presentPokerTask,
        private ShareOptions $shareOptions,
        private SharePermissions $sharePermissions,
        private LatestDeliveries $latestDeliveries,
    ) {}

    /**
     * @return Snapshot
     */
    public function handle(PokerGame $game, PokerPlayer $viewer): array
    {
        $game->load([
            'team.workspace',
            'players.user',
            'tasks' => fn ($query) => $query->withCount('rounds'),
            'tasks.latestRound' => fn ($query) => $query->withCount('votes'),
            'currentTask.latestRound.votes',
        ]);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isFacilitator = $game->isFacilitator($viewer);
        $isNumeric = $game->isNumeric();
        $currentRound = $game->latestRoundOfCurrentTask();
        $team = $game->team;
        $sync = $isGuest ? null : PokerTaskSync::for($game);

        return [
            'game' => [
                'id' => $game->id,
                'title' => $game->title,
                'deck' => $game->deck->value,
                'deckLabel' => $game->deckLabel(),
                'cards' => $game->cards,
                'isNumeric' => $isNumeric,
                'facilitatorPlayerId' => $game->facilitator_player_id,
                'guestAccessEnabled' => $game->guest_access_enabled,
                'guestUrl' => ! $isGuest && $game->guest_access_enabled ? route('poker.join.show', $game->guest_token) : null,
                'endedAt' => $game->ended_at?->toIso8601String(),
                'currentTaskId' => $game->current_task_id,
                'tasksCount' => $game->tasks->count(),
                'estimatedCount' => $game->tasks->whereNotNull('estimated_at')->count(),
                'totalPoints' => $isNumeric
                    ? round((float) $game->tasks->sum(fn (PokerTask $task): float => $task->estimate_numeric ?? 0.0), 2)
                    : null,
                'hasVotes' => $game->hasVotes(),
                'autoReveal' => $game->auto_reveal,
                'anonymousVotes' => $game->anonymous_votes,
                'cursorsEnabled' => $game->cursors_enabled,
                'reactionsEnabled' => $game->reactions_enabled,
                'teamName' => $isGuest ? null : $team->name,
            ],
            'me' => [
                'playerId' => $viewer->id,
                'userId' => $viewer->user_id,
                'isGuest' => $isGuest,
                'isFacilitator' => $isFacilitator,
                'isSpectator' => $viewer->is_spectator,
                'canVote' => ! $viewer->is_spectator,
                'canEditTasks' => ! $isGuest,
                'canTakeControl' => ! $isGuest && ! $isFacilitator,
                'canDelete' => $isFacilitator || ($viewer->user?->canManage($team->workspace) ?? false),
                'transferCandidates' => $isFacilitator && ! $isGuest ? $this->transferCandidates($game, $viewer) : [],
            ],
            'players' => $game->players->map(fn (PokerPlayer $player): array => [
                'id' => $player->id,
                'name' => $player->displayName(),
                'avatarUrl' => $player->avatarUrl(),
                'isGuest' => $player->isGuest(),
                'isSpectator' => $player->is_spectator,
            ])->values()->all(),
            'tasks' => $game->tasks->map(fn (PokerTask $task): array => $this->presentPokerTask->handle($task, $sync))->values()->all(),
            'current' => $currentRound === null ? null : [
                'taskId' => $currentRound->poker_task_id,
                'round' => $this->presentPokerRound->handle($currentRound, $game, $viewer->id),
            ],
            'team' => $isGuest ? null : ['id' => $team->id, 'workspace' => $team->workspace->slug],
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$team->workspace, $team]),
            ],
            'integrations' => $sync?->summary(),
            'share' => $this->shareOptions->pokerGame($game, $viewer),
            'deliveries' => $this->sharePermissions->pokerGame($game, $viewer)
                ? $this->latestDeliveries->handle($game, [IntegrationDeliveryKind::PokerLink])
                : [],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /**
     * @return array<int, array{
     *     userId: string,
     *     name: string
     * }>
     */
    private function transferCandidates(PokerGame $game, PokerPlayer $viewer): array
    {
        $team = $game->team;

        $managerIds = $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('users.id');

        return User::query()
            ->where(fn (Builder $query) => $query
                ->whereIn('id', $team->members()->select('users.id'))
                ->orWhereIn('id', $managerIds))
            ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }
}
