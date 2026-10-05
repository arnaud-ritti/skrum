<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Gifs\GifCatalog;
use App\Support\RateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        RateLimit::hit("gif-search:{$participant->id}", self::SearchesPerMinute, __('Too many searches, wait a moment.'));

        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        return response()->json(['gifs' => $gifCatalog->pickerResults($validated['q'] ?? '')]);
    }
}
