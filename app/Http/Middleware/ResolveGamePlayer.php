<?php

namespace App\Http\Middleware;

use App\Actions\Games\ExpireGameRound;
use App\Actions\Games\FindGamePlayer;
use App\Actions\Retros\GuestCookie;
use App\Enums\GameRoomAccess;
use App\Http\Middleware\Concerns\RefusesMissingMember;
use App\Models\GameRoom;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveGamePlayer
{
    use RefusesMissingMember;

    public function __construct(
        private FindGamePlayer $findGamePlayer,
        private ExpireGameRound $expireGameRound,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $room = $request->route('room');

        abort_unless($room instanceof GameRoom, 404);

        $player = $this->findGamePlayer->handle($request, $room);

        if ($player === null) {
            return $this->refuseMissingMember($request, ! $room->isIcebreaker() && $room->access === GameRoomAccess::Link, $this->guestCookieName($room), __('You no longer have access to this room.'));
        }

        $request->attributes->set('gamePlayer', $player);

        rescue(fn () => $this->expireGameRound->handle($room), report: true);

        return $next($request);
    }

    private function guestCookieName(GameRoom $room): string
    {
        if ($room->retro_id !== null) {
            return GuestCookie::name(GuestCookie::RetroScope, $room->retro_id);
        }

        return GuestCookie::name(GuestCookie::GameScope, $room->id);
    }
}
