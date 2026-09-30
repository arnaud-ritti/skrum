<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;

class PresentGamePlayer
{
    /**
     * @return array{
     *     id: string,
     *     presenceId: string,
     *     name: string,
     *     avatarUrl: string,
     *     isGuest: bool
     * }
     */
    public function handle(GamePlayer $player): array
    {
        return [
            'id' => $player->id,
            'presenceId' => $player->presenceId(),
            'name' => $player->displayName(),
            'avatarUrl' => $player->avatarUrl(),
            'isGuest' => $player->isGuest(),
        ];
    }
}
