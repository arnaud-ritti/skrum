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
            return PokerPlayer::query()->firstOrCreate(
                ['poker_game_id' => $game->id, 'user_id' => $user->id],
                fn (): array => ['is_spectator' => $user->isObserverOf($game->team)],
            );
        }

        return $this->guest($request, $game);
    }

    private function guest(Request $request, PokerGame $game): ?PokerPlayer
    {
        return $game->guest_access_enabled
            ? GuestCookie::findGuest($game->players(), $request, GuestCookie::PokerScope, $game->id)
            : null;
    }
}
