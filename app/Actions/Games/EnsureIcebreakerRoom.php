<?php

namespace App\Actions\Games;

use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Retro;
use Illuminate\Support\Str;

/**
 * One room per retro, created the first time the retro enters its
 * Icebreaker phase (or the first time a board snapshot needs it). The
 * unique retro_id and createOrFirst make concurrent first loads agree.
 */
class EnsureIcebreakerRoom
{
    public function handle(Retro $retro): GameRoom
    {
        $room = GameRoom::query()->where('retro_id', $retro->id)->first()
            ?? GameRoom::query()->createOrFirst(['retro_id' => $retro->id], [
                'team_id' => $retro->team_id,
                'game' => $retro->icebreaker_game,
                'locale' => $this->facilitatorLocale($retro),
                'access' => GameRoomAccess::Team,
                'guest_token' => Str::random(40),
            ]);

        $room->setRelation('retro', $retro);

        $this->ensureFacilitatorPlayer($room, $retro);

        return $room;
    }

    private function facilitatorLocale(Retro $retro): string
    {
        $locale = $retro->facilitator?->user?->preferredLocale();

        if (is_string($locale) && in_array($locale, (array) config('skrum.locales'), true)) {
            return $locale;
        }

        return app()->getLocale();
    }

    /**
     * Every viewer's snapshot names the host from the first load.
     */
    private function ensureFacilitatorPlayer(GameRoom $room, Retro $retro): void
    {
        if ($retro->facilitator_participant_id === null) {
            return;
        }

        GamePlayer::query()->firstOrCreate([
            'game_room_id' => $room->id,
            'participant_id' => $retro->facilitator_participant_id,
        ]);
    }
}
