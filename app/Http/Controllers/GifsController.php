<?php

namespace App\Http\Controllers;

use App\Support\Gifs\Gif;
use App\Support\Gifs\GifCatalog;
use finfo;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class GifsController extends Controller
{
    private const MaxBytes = 5 * 1024 * 1024;

    private const AllowedTypes = ['image/gif', 'image/webp'];

    public function show(string $gif, string $size, GifCatalog $gifCatalog): Response
    {
        abort_unless($gifCatalog->isAvailable(), 404);

        $failureMessage = __('This GIF could not be loaded.');

        $found = $gifCatalog->attempt(fn (): ?Gif => $gifCatalog->servable($gif), $failureMessage);

        abort_if($found === null, 404, __('This GIF could not be found.'));

        $disk = Storage::disk();
        $path = "gifs/{$gifCatalog->providerName()}/{$gif}-{$size}";

        if (! $disk->exists($path)) {
            $body = $gifCatalog->attempt(
                fn (): string => $this->download($size === 'preview' ? $found->previewUrl : $found->fullUrl, $failureMessage),
                $failureMessage,
            );

            $disk->put($path, $body);
        }

        return response((string) $disk->get($path), 200, [
            'Content-Type' => $disk->mimeType($path) ?: 'image/gif',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * The body is read in chunks so an oversized upstream image is refused
     * without being held in memory in full.
     */
    private function download(string $url, string $failureMessage): string
    {
        $response = Http::timeout(10)->withOptions(['stream' => true])->get($url)->throw();

        $declaredType = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));

        abort_unless(in_array($declaredType, self::AllowedTypes, true), 502, $failureMessage);
        abort_if((int) $response->header('Content-Length') > self::MaxBytes, 502, $failureMessage);

        $stream = $response->toPsrResponse()->getBody();
        $body = '';

        while (! $stream->eof() && strlen($body) <= self::MaxBytes) {
            $body .= $stream->read(65536);
        }

        abort_if(strlen($body) > self::MaxBytes, 502, $failureMessage);
        abort_unless(in_array((new finfo(FILEINFO_MIME_TYPE))->buffer($body), self::AllowedTypes, true), 502, $failureMessage);

        return $body;
    }
}
