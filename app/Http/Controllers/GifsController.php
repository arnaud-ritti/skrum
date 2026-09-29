<?php

namespace App\Http\Controllers;

use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class GifsController extends Controller
{
    public function show(string $gif, string $size, GifCatalog $gifCatalog): Response
    {
        abort_unless($gifCatalog->isAvailable(), 404);

        $failureMessage = __('This GIF could not be loaded.');

        $found = $gifCatalog->attempt(fn (): ?Gif => $gifCatalog->servable($gif), $failureMessage);

        abort_if($found === null, 404, __('This GIF could not be found.'));

        $disk = Storage::disk();
        $path = "gifs/{$gifCatalog->providerName()}/{$found->id}-{$size}";

        if (! $disk->exists($path)) {
            $body = $gifCatalog->attempt(
                fn (): string => Http::timeout(10)->get($size === 'preview' ? $found->previewUrl : $found->fullUrl)->throw()->body(),
                $failureMessage,
            );

            $disk->put($path, $body);
        }

        return response((string) $disk->get($path), 200, [
            'Content-Type' => $disk->mimeType($path) ?: 'image/gif',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
