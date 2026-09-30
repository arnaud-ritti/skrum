<?php

namespace App\Actions\Games;

use App\Actions\Retros\GuestCookie;
use App\Actions\Retros\ResolveParticipant;
use App\Enums\GameRoomAccess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;

class FindGamePlayer
{
    public function __construct(private ResolveParticipant $resolveParticipant) {}

    public function handle(Request $request, GameRoom $room): ?GamePlayer
    {
        if ($room->isIcebreaker()) {
            return $this->participantPlayer($request, $room);
        }

        $user = $request->user();

        if ($user !== null && $user->can('view', $room->team)) {
            return GamePlayer::query()->firstOrCreate([
                'game_room_id' => $room->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $room);
    }

    /**
     * Icebreaker access follows the retro: whoever is a participant plays.
     */
    private function participantPlayer(Request $request, GameRoom $room): ?GamePlayer
    {
        $retro = $room->retro;

        if ($retro === null) {
            return null;
        }

        $participant = $this->resolveParticipant->handle($request, $retro);

        if ($participant === null) {
            return null;
        }

        return GamePlayer::query()->firstOrCreate([
            'game_room_id' => $room->id,
            'participant_id' => $participant->id,
        ]);
    }

    private function guest(Request $request, GameRoom $room): ?GamePlayer
    {
        if ($room->access !== GameRoomAccess::Link) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::GameScope, $room->id)));

        if ($credentials === null) {
            return null;
        }

        [$playerId, $secret] = $credentials;

        $player = $room->players()
            ->whereKey($playerId)
            ->whereNull('user_id')
            ->whereNull('participant_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($player === null) {
            return null;
        }

        if (! hash_equals((string) $player->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $player;
    }
}
