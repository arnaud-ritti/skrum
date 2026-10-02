<?php

namespace App\Actions\Sessions;

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Whiteboard;

class PresentJoinSession
{
    /**
     * @return array{
     *     title: string,
     *     facilitatorName: ?string,
     *     participantsCount: int,
     *     isLive: bool
     * }
     */
    public function retro(Retro $retro): array
    {
        return [
            'title' => $retro->title,
            'facilitatorName' => $retro->facilitator?->displayName(),
            'participantsCount' => $retro->participants()->count(),
            'isLive' => $retro->phase->isOpen(),
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
