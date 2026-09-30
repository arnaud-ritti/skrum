<?php

namespace App\Actions\Integrations;

use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Spec 6 §8: the retro's facilitator while they are a team member, the
 * game's facilitator, and workspace Owners/Admins. Guests never share.
 */
class SharePermissions
{
    public function retro(Retro $retro, Participant $participant): bool
    {
        $user = $participant->user;

        if ($participant->isGuest() || $user === null) {
            return false;
        }

        $retro->loadMissing(['team.workspace', 'team.members']);

        if ($user->canManage($retro->team->workspace)) {
            return true;
        }

        return $retro->isFacilitator($participant) && $retro->team->members->contains('id', $user->id);
    }

    public function ensureRetro(Retro $retro, Participant $participant): User
    {
        $user = $participant->user;

        if ($user === null || ! $this->retro($retro, $participant)) {
            throw new AuthorizationException(__('Only the facilitator or a workspace admin can share this retrospective.'));
        }

        return $user;
    }

    public function pokerGame(PokerGame $game, PokerPlayer $player): bool
    {
        $user = $player->user;

        if ($player->isGuest() || $user === null) {
            return false;
        }

        if ($game->isFacilitator($player)) {
            return true;
        }

        return $user->canManage($game->team->workspace);
    }

    public function ensurePokerGame(PokerGame $game, PokerPlayer $player): User
    {
        $user = $player->user;

        if ($user === null || ! $this->pokerGame($game, $player)) {
            throw new AuthorizationException(__('Only the facilitator or a workspace admin can share this game.'));
        }

        return $user;
    }
}
