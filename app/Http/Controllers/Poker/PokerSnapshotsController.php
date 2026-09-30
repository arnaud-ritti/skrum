<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\BuildPokerSnapshot;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerSnapshotsController extends Controller
{
    public function show(Request $request, PokerGame $game, BuildPokerSnapshot $buildPokerSnapshot): JsonResponse
    {
        return response()->json($buildPokerSnapshot->handle($game, PokerPlayer::current($request)));
    }
}
