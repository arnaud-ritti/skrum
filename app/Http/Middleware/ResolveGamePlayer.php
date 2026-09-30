<?php

namespace App\Http\Middleware;

use App\Actions\Games\ExpireGameRound;
use App\Actions\Games\FindGamePlayer;
use App\Actions\Retros\GuestCookie;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveGamePlayer
{
    public function __construct(
        private FindGamePlayer $findGamePlayer,
        private ExpireGameRound $expireGameRound,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $room = $request->route('room');

        abort_unless($room instanceof GameRoom, 404);

        $player = $this->findGamePlayer->handle($request, $room);

        if ($player === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $room);
        }

        if ($player === null) {
            abort_if($request->user() === null && ! $request->cookies->has($this->guestCookieName($room)), 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this room.'));
        }

        $request->attributes->set('gamePlayer', $player);

        $this->expireGameRound->handle($room);

        return $next($request);
    }

    private function guestCookieName(GameRoom $room): string
    {
        if ($room->retro_id !== null) {
            return GuestCookie::name(GuestCookie::RetroScope, $room->retro_id);
        }

        return GuestCookie::name(GuestCookie::GameScope, $room->id);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so link rooms explain both ways back.
     */
    private function sendToLogin(Request $request, GameRoom $room): Response
    {
        if ($room->isIcebreaker() || $room->access !== GameRoomAccess::Link) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
