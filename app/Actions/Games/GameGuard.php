<?php

namespace App\Actions\Games;

use App\Actions\Retros\RetroGuard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class GameGuard
{
    /**
     * Standalone rooms are always playable; an icebreaker only during its
     * retro's Icebreaker phase and while the board is not locked.
     */
    public static function mutable(GameRoom $room): void
    {
        if (! $room->isIcebreaker()) {
            return;
        }

        $retro = $room->retro;

        if ($retro === null || $retro->phase !== RetroPhase::Icebreaker) {
            throw new AuthorizationException(__('The game can only be played during the icebreaker.'));
        }

        RetroGuard::unlocked($retro);
    }

    public static function host(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isHost($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the host can do this.'));
    }

    public static function manager(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isManager($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the host, the room creator or a workspace admin can do this.'));
    }

    public static function canDelete(GameRoom $room, GamePlayer $player): void
    {
        if ($room->isCreator($player)) {
            return;
        }

        if ($player->account()?->canManage($room->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the room creator or a workspace admin can delete this room.'));
    }

    public static function standalone(GameRoom $room): void
    {
        if (! $room->isIcebreaker()) {
            return;
        }

        throw new NotFoundHttpException;
    }

    public static function member(GamePlayer $player): void
    {
        if (! $player->isGuest()) {
            return;
        }

        throw new AuthorizationException(__('Guests cannot do this.'));
    }

    public static function activeRound(GameRoom $room, GameRound $round): void
    {
        if ($room->current_round_id === $round->id && $round->isActive()) {
            return;
        }

        throw new ConflictHttpException(__('This round is over.'));
    }

    public static function roundGame(GameRound $round, GameKind ...$games): void
    {
        if (in_array($round->game, $games, true)) {
            return;
        }

        throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
    }

    public static function leaderOrHost(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        if ($round->leader_player_id === $player->id || $room->isHost($player)) {
            return;
        }

        throw new AuthorizationException(__('Only the leader or the host can do this.'));
    }
}
