<?php

namespace App\Actions\Sessions;

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\User;
use App\Models\Whiteboard;
use App\Support\Sessions\GuestNames;
use Inertia\Inertia;
use Inertia\OptionalProp;

class PresentJoinSession
{
    /**
     * The nickname the join form opens with: the name of a signed-in visitor,
     * a random one otherwise. `randomName` is only computed when the page asks
     * for another one.
     *
     * @return array{
     *     suggestedName: string,
     *     randomName: OptionalProp
     * }
     */
    public function nickname(?User $visitor): array
    {
        $locale = app()->getLocale();

        return [
            'suggestedName' => $visitor?->name ?? GuestNames::random($locale),
            'randomName' => Inertia::optional(fn (): string => GuestNames::random($locale)),
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool,
     *     hasAnonymousCards: bool
     * }
     */
    public function retro(Retro $retro): array
    {
        return [
            'title' => $retro->title,
            'facilitatorName' => $retro->facilitator?->displayName(),
            'participantsCount' => $retro->participants()->count(),
            'isLive' => $retro->phase->isOpen(),
            'hasAnonymousCards' => $retro->is_anonymous,
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function poker(PokerGame $game): array
    {
        return [
            'title' => $game->title,
            'facilitatorName' => $game->facilitator?->displayName(),
            'participantsCount' => $game->players()->count(),
            'isLive' => ! $game->isEnded(),
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     gameLabel: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function game(GameRoom $room): array
    {
        $gameLabel = $room->game->label();

        return [
            'title' => $room->name ?? $gameLabel,
            'gameLabel' => $gameLabel,
            'facilitatorName' => $room->host?->displayName(),
            'participantsCount' => $room->players()->count(),
            'isLive' => true,
        ];
    }

    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function whiteboard(Whiteboard $board): array
    {
        return [
            'title' => $board->title,
            'facilitatorName' => $board->facilitator?->displayName(),
            'participantsCount' => $board->members()->count(),
            'isLive' => true,
        ];
    }
}
