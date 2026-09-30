<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Games\GameRulesRegistry;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class GameGifsController extends Controller
{
    private const SearchesPerMinute = 20;

    public function index(Request $request, GameRoom $room, GifCatalog $gifCatalog, GameRulesRegistry $gameRulesRegistry): JsonResponse
    {
        $player = GamePlayer::current($request);

        abort_unless($gifCatalog->isAvailable(), 404);

        GameGuard::mutable($room);

        if (! $gameRulesRegistry->isAvailable(GameKind::SprintGif, $room)) {
            throw new AuthorizationException(__('GIFs are turned off for this board.'));
        }

        $this->throttle($player);

        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        $gifs = $gifCatalog->attempt(
            fn (): array => $gifCatalog->search($validated['q'] ?? ''),
            __('GIF search is unavailable.'),
        );

        return response()->json([
            'gifs' => array_map(fn (Gif $gif): array => [
                'id' => $gif->id,
                'previewUrl' => route('gifs.show', ['gif' => $gif->id, 'size' => 'preview'], false),
                'width' => $gif->width,
                'height' => $gif->height,
            ], $gifs),
        ]);
    }

    /**
     * Throttled here rather than by route middleware, which runs before the
     * player is resolved and would fall back to one limit per IP.
     */
    private function throttle(GamePlayer $player): void
    {
        $key = "game-gif-search:{$player->id}";

        if (RateLimiter::tooManyAttempts($key, self::SearchesPerMinute)) {
            throw new ThrottleRequestsException(__('Too many searches, wait a moment.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key);
    }
}
