<?php

namespace App\Actions\Poker;

use App\Actions\Retros\GuestCookie;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;

class ResolvePlayer
{
    public function handle(Request $request, PokerGame $game): ?PokerPlayer
    {
        $user = $request->user();

        if ($user !== null && $user->can('view', $game->team)) {
            return PokerPlayer::query()->firstOrCreate([
                'poker_game_id' => $game->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $game);
    }

    private function guest(Request $request, PokerGame $game): ?PokerPlayer
    {
        if (! $game->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::PokerScope, $game->id)));

        if ($credentials === null) {
            return null;
        }

        [$playerId, $secret] = $credentials;

        $player = $game->players()
            ->whereKey($playerId)
            ->whereNull('user_id')
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
