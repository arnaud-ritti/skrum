<?php

namespace App\Actions\Integrations;

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\User;
use App\Support\Integrations\Messages\LinkShareContent;

/**
 * An invitation carries the title, the team, the sharer's name and a URL,
 * never any board or game content (spec 6 §5.1). The guest URL is used
 * only when the sharer ticked the option.
 */
class BuildLinkShare
{
    public function retro(Retro $retro, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        return new LinkShareContent(
            __(':sharer invites you to the retrospective ":title" (:team)', [
                'sharer' => $sharer->name,
                'title' => $retro->title,
                'team' => $retro->team->name,
            ]),
            __('Open the retrospective'),
            $includeGuestLink ? route('retros.join.show', $retro->guest_token) : route('retros.show', $retro),
        );
    }

    public function pokerGame(PokerGame $game, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        return new LinkShareContent(
            __(':sharer invites you to the planning poker game ":title" (:team)', [
                'sharer' => $sharer->name,
                'title' => $game->title,
                'team' => $game->team->name,
            ]),
            __('Open the game'),
            $includeGuestLink ? route('poker.join.show', $game->guest_token) : route('poker.show', $game),
        );
    }

    /**
     * A room invite names the room, its game and team, never the players or
     * the game state (spec 7 §3.1).
     */
    public function gameRoom(GameRoom $room, User $sharer, bool $includeGuestLink): LinkShareContent
    {
        return new LinkShareContent(
            __(':sharer invites you to play :game in ":room" (:team)', [
                'sharer' => $sharer->name,
                'game' => $room->game->label(),
                'room' => (string) $room->name,
                'team' => $room->team->name,
            ]),
            __('Join the game'),
            $includeGuestLink ? route('games.join.show', $room->guest_token) : route('games.show', $room),
        );
    }
}
