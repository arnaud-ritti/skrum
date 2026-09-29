<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Retro;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RetroGifsController extends Controller
{
    public function index(Request $request, Retro $retro, GifCatalog $gifCatalog): JsonResponse
    {
        abort_unless($gifCatalog->isAvailable(), 404);

        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::gifsEnabled($retro, $gifCatalog);

        $validated = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        $gifs = $gifCatalog->attempt(
            fn (): array => $gifCatalog->search($validated['q'] ?? ''),
            __('GIF search is unavailable.'),
        );

        return response()->json([
            'gifs' => array_map(fn (Gif $gif) => [
                'id' => $gif->id,
                'previewUrl' => route('gifs.show', ['gif' => $gif->id, 'size' => 'preview'], false),
                'width' => $gif->width,
                'height' => $gif->height,
            ], $gifs),
        ]);
    }
}
