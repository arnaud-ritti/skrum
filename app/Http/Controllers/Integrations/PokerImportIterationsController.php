<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ListPokerIterations;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportIterationsController extends Controller
{
    public function index(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, ListPokerIterations $listPokerIterations): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canBrowseTracker($game, $player);

        $validated = $request->validate([
            'container' => ['required', 'string', 'max:100'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        TrackerBrowseLimit::hit($player->user_id ?? $player->id);

        return response()->json($listPokerIterations->iterations($integration, (string) $validated['container']));
    }
}
