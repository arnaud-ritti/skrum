<?php

namespace App\Actions\Poker;

use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\User;

class BuildPokerSnapshot
{
    public function __construct(
        private PresentPokerRound $presentPokerRound,
        private PresentPokerTask $presentPokerTask,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(PokerGame $game, PokerPlayer $viewer): array
    {
        $game->load([
            'team.workspace',
            'players.user',
            'tasks' => fn ($query) => $query->withCount('rounds'),
            'currentTask.latestRound.votes',
        ]);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isFacilitator = $game->isFacilitator($viewer);
        $isNumeric = $game->isNumeric();
        $currentRound = $game->latestRoundOfCurrentTask();
        $team = $game->team;

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
            'tasks' => $game->tasks->map(fn (PokerTask $task): array => $this->presentPokerTask->handle($task))->values()->all(),
            'current' => $currentRound === null ? null : [
                'taskId' => $currentRound->poker_task_id,
                'round' => $this->presentPokerRound->handle($currentRound, $game, $viewer->id),
            ],
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$team->workspace, $team]),
            ],
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
            ->where(fn ($query) => $query
                ->whereIn('id', $team->members()->select('users.id'))
                ->orWhereIn('id', $managerIds))
            ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }
}
