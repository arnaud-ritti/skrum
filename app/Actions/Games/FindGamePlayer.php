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
    public function __construct(
        private ResolveParticipant $resolveParticipant,
        private AnnounceTeamGameRoom $announceTeamGameRoom,
    ) {}

    public function handle(Request $request, GameRoom $room): ?GamePlayer
    {
        if ($room->isIcebreaker()) {
            return $this->participantPlayer($request, $room);
        }

        $user = $request->user();

        if ($user !== null && $user->can('view', $room->team)) {
            $player = GamePlayer::query()->firstOrCreate([
                'game_room_id' => $room->id,
                'user_id' => $user->id,
            ]);

            if ($player->wasRecentlyCreated) {
                $this->announceTeamGameRoom->changed($room);
            }

            return $player;
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
        return $room->access === GameRoomAccess::Link
            ? GuestCookie::findGuest($room->players()->whereNull('participant_id'), $request, GuestCookie::GameScope, $room->id)
            : null;
    }
}
