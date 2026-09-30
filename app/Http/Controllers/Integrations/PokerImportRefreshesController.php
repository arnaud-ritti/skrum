<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\RefreshPokerTasks;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportRefreshesController extends Controller
{
    public function store(Request $request, PokerGame $game, RefreshPokerTasks $refreshPokerTasks): JsonResponse
    {
        return response()->json($refreshPokerTasks->handle($game, PokerPlayer::current($request)));
    }
}
