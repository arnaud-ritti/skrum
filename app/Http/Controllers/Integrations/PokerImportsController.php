<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerImportsController extends Controller
{
    public function store(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, ImportPokerTasks $importPokerTasks): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'external_ids' => ['required', 'array', 'min:1', 'max:100'],
            'external_ids.*' => ['required', 'string', 'max:100', 'distinct'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        TrackerBrowseLimit::hit($player->user_id ?? $player->id);

        return response()->json(
            $importPokerTasks->handle($game, $player, $integration, array_values($validated['external_ids'])),
            201,
        );
    }
}
