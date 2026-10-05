<?php

namespace App\Http\Middleware;

use App\Actions\Poker\ResolvePlayer;
use App\Actions\Poker\SetPokerSpectator;
use App\Actions\Retros\GuestCookie;
use App\Http\Middleware\Concerns\RefusesMissingMember;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ResolvePokerPlayer
{
    use RefusesMissingMember;

    public function __construct(
        private ResolvePlayer $resolvePlayer,
        private SetPokerSpectator $setPokerSpectator,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $game = $request->route('game');

        abort_unless($game instanceof PokerGame, 404);

        $player = $this->resolvePlayer->handle($request, $game);

        if ($player === null) {
            return $this->refuseMissingMember($request, $game->guest_access_enabled, GuestCookie::name(GuestCookie::PokerScope, $game->id), __('You no longer have access to this game.'));
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
}
