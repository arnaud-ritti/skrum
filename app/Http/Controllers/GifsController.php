<?php

namespace App\Http\Controllers;

use App\Support\BoundedDownload;
use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use finfo;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class GifsController extends Controller
{
    private const int MaxBytes = 5 * 1024 * 1024;

    private const array AllowedTypes = ['image/gif', 'image/webp'];

    public function show(string $gif, string $size, GifCatalog $gifCatalog): Response
    {
        abort_unless($gifCatalog->isAvailable(), 404);

        $failureMessage = __('This GIF could not be loaded.');

        $found = $gifCatalog->attempt(fn (): ?Gif => $gifCatalog->servable($gif), $failureMessage);

        abort_if($found === null, 404, __('This GIF could not be found.'));

        $disk = Storage::disk();
        $path = "gifs/{$gifCatalog->providerName()}/{$gif}-{$size}";

        $body = (string) $disk->get($path);

        if ($body === '') {
            $body = $gifCatalog->attempt(
                fn (): string => $this->download($size === 'preview' ? $found->previewUrl : $found->fullUrl, $failureMessage),
                $failureMessage,
            );

            BoundedDownload::atomicPut($disk, $path, $body);
        }

        return response($body, 200, [
            'Content-Type' => new finfo(FILEINFO_MIME_TYPE)->buffer($body) ?: 'image/gif',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function download(string $url, string $failureMessage): string
    {
        $body = BoundedDownload::fetch($url, self::MaxBytes, self::AllowedTypes, $failureMessage);

        abort_unless(in_array(new finfo(FILEINFO_MIME_TYPE)->buffer($body), self::AllowedTypes, true), 502, $failureMessage);

        return $body;
    }
}
