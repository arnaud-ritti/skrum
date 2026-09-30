<?php

namespace App\Http\Middleware;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolvePokerPlayer
{
    public function __construct(private ResolvePlayer $resolvePlayer) {}

    public function handle(Request $request, Closure $next): Response
    {
        $game = $request->route('game');

        abort_unless($game instanceof PokerGame, 404);

        $player = $this->resolvePlayer->handle($request, $game);

        if ($player === null && $request->user() === null && ! $request->expectsJson()) {
            return $this->sendToLogin($request, $game);
        }

        if ($player === null) {
            $hasGuestCookie = $request->cookies->has(GuestCookie::name(GuestCookie::PokerScope, $game->id));

            abort_if($request->user() === null && ! $hasGuestCookie, 401, __('Your session has expired.'));

            abort(403, __('You no longer have access to this game.'));
        }

        $request->attributes->set('pokerPlayer', $player);

        return $next($request);
    }

    /**
     * Once the guest cookie is gone, an expired guest cannot be told apart
     * from a logged-out member, so guest-enabled games explain both ways back.
     */
    private function sendToLogin(Request $request, PokerGame $game): Response
    {
        if (! $game->guest_access_enabled) {
            return redirect()->guest(route('login'));
        }

        redirect()->setIntendedUrl($request->fullUrl());

        return Inertia::render('retros/session-ended')->toResponse($request);
    }
}
