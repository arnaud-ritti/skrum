<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Games\GameRulesRegistry;
use App\Support\Gifs\GifCatalog;
use App\Support\RateLimit;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameGifsController extends Controller
{
    private const int SearchesPerMinute = 20;

    public function index(Request $request, GameRoom $room, GifCatalog $gifCatalog, GameRulesRegistry $gameRulesRegistry): JsonResponse
    {
        $player = GamePlayer::current($request);

        abort_unless($gifCatalog->isAvailable(), 404);

        GameGuard::mutable($room);

        if (! $gameRulesRegistry->isAvailable(GameKind::SprintGif, $room)) {
            throw new AuthorizationException(__('GIFs are turned off for this board.'));
        }

        RateLimit::hit("game-gif-search:{$player->id}", self::SearchesPerMinute, __('Too many searches, wait a moment.'));

        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        return response()->json(['gifs' => $gifCatalog->pickerResults($validated['q'] ?? '')]);
    }
}
