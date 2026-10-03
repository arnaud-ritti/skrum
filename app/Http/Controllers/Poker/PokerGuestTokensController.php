<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Sessions\JoinCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PokerGuestTokensController extends Controller
{
    public function store(Request $request, PokerGame $game, JoinCodes $joinCodes): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $guestToken = DB::transaction(function () use ($game, $player): string {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $locked->update(['guest_token' => Str::random(40)]);

            $locked->players()
                ->whereNull('user_id')
                ->whereNotNull('guest_secret_hash')
                ->update(['guest_secret_hash' => null]);

            (new PokerGameChanged($locked->id))->sendToOthers();

            return $locked->guest_token;
        });

        return response()->json([
            'guestUrl' => route('poker.join.show', $guestToken),
            'joinCode' => $joinCodes->rotate($game),
        ]);
    }
}
