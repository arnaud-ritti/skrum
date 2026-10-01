<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class RetroGifsController extends Controller
{
    private const int SearchesPerMinute = 20;

    public function index(Request $request, Retro $retro, GifCatalog $gifCatalog): JsonResponse
    {
        $participant = Participant::current($request);

        abort_unless($gifCatalog->isAvailable(), 404);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::gifsEnabled($retro, $gifCatalog);

        $this->throttle($participant);

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
     * participant is resolved and would fall back to one limit per IP.
     */
    private function throttle(Participant $participant): void
    {
        $key = "gif-search:{$participant->id}";

        if (RateLimiter::tooManyAttempts($key, self::SearchesPerMinute)) {
            throw new ThrottleRequestsException(__('Too many searches, wait a moment.'), null, ['Retry-After' => RateLimiter::availableIn($key)]);
        }

        RateLimiter::hit($key);
    }
}
