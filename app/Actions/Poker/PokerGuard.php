<?php

namespace App\Actions\Poker;

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class PokerGuard
{
    public static function facilitator(PokerGame $game, PokerPlayer $player): void
    {
        if ($game->isFacilitator($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function notEnded(PokerGame $game): void
    {
        if (! $game->isEnded()) {
            return;
        }

        throw new AuthorizationException(__('This game has ended.'));
    }

    public static function canEditTasks(PokerPlayer $player): void
    {
        if (! $player->isGuest()) {
            return;
        }

        throw new AuthorizationException(__("Guests can't add or edit tasks."));
    }

    public static function canVote(PokerPlayer $player): void
    {
        if (! $player->is_spectator) {
            return;
        }

        throw new AuthorizationException(__("Spectators can't vote."));
    }

    /**
     * Only the latest round of the current task accepts votes, and only
     * until it is revealed.
     */
    public static function openRound(PokerGame $game, PokerRound $round): void
    {
        $latest = $game->latestRoundOfCurrentTask();

        if ($latest !== null && $latest->id === $round->id && ! $round->isRevealed()) {
            return;
        }

        throw ValidationException::withMessages(['votes' => __('Voting is closed for this round.')]);
    }

    public static function canDelete(PokerGame $game, PokerPlayer $player): void
    {
        if ($game->isFacilitator($player)) {
            return;
        }

        if ($player->user?->canManage($game->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator or a workspace admin can delete this game.'));
    }

    public static function notManaged(PokerTask $task): void
    {
        if ($task->external_source === null) {
            return;
        }

        $source = IntegrationProvider::tryFrom($task->external_source)?->label() ?? $task->external_source;

        throw ValidationException::withMessages(['title' => __('This task is managed in :source.', ['source' => $source])]);
    }
}
