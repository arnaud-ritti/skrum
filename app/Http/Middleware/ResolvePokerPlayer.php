<?php

namespace App\Http\Middleware;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Poker\SetPokerSpectator;
use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolvePokerPlayer
{
    public function __construct(
        private ResolvePlayer $resolvePlayer,
        private SetPokerSpectator $setPokerSpectator,
    ) {}

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

        $request->attributes->set('pokerPlayer', $this->keepObserverWatching($request, $game, $player));

        return $next($request);
    }

    /**
     * An observer watches: a player who became one stops playing the next time they open the game.
     */
    private function keepObserverWatching(Request $request, PokerGame $game, PokerPlayer $player): PokerPlayer
    {
        $user = $request->user();

        if ($user === null || $player->is_spectator) {
            return $player;
        }

        if ($game->isEnded() || $game->isFacilitator($player)) {
            return $player;
        }

        if (! $user->isObserverOf($game->team)) {
            return $player;
        }

        DB::transaction(function () use ($game, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            $this->setPokerSpectator->handle($locked, $player, true);
        });

        return $player->refresh();
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
