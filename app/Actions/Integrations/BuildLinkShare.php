<?php

namespace App\Actions\Integrations;

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
}
