<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PreviewPokerImport;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PokerImportPreviewsController extends Controller
{
    public function store(Request $request, PokerGame $game, string $source, ResolvePokerTracker $resolvePokerTracker, PreviewPokerImport $previewPokerImport): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'mode' => ['required', Rule::in([PreviewPokerImport::ModeIteration, PreviewPokerImport::ModeQuery])],
            'iteration_id' => ['required_if:mode,iteration', 'nullable', 'string', 'max:100'],
            'query' => ['required_if:mode,query', 'nullable', 'string', 'max:1000'],
        ]);

        $integration = $resolvePokerTracker->handle($game->team, $source);

        TrackerBrowseLimit::hit($player->user_id ?? $player->id);

        return response()->json($previewPokerImport->handle(
            $game,
            $integration,
            $validated['mode'],
            $validated['iteration_id'] ?? null,
            $validated['query'] ?? null,
        ));
    }
}
