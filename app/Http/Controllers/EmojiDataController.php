<?php

namespace App\Http\Controllers;

use App\Support\BoundedDownload;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class EmojiDataController extends Controller
{
    private const array Files = ['data.json', 'messages.json'];

    private const int MaxBytes = 10 * 1024 * 1024;

    public function show(string $version, string $locale, string $file): Response
    {
        abort_unless($version === config('services.emoji_data.version'), 404);
        abort_unless(in_array($locale, config('skrum.locales'), true), 404);
        abort_unless(in_array($file, self::Files, true), 404);

        $disk = Storage::disk();
        $path = "emoji-data/{$version}/{$locale}/{$file}";

        $body = (string) $disk->get($path);

        if ($body === '') {
            $body = $this->download($version, $locale, $file);

            BoundedDownload::atomicPut($disk, $path, $body);
        }

        return response($body, 200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'ETag' => '"'.hash('xxh128', $body).'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function download(string $version, string $locale, string $file): string
    {
        $failureMessage = __('Emoji list unavailable');

        try {
            $body = BoundedDownload::fetch("https://cdn.jsdelivr.net/npm/emojibase-data@{$version}/{$locale}/{$file}", self::MaxBytes, ['application/json'], $failureMessage);
        } catch (RequestException|ConnectionException) {
            abort(502, $failureMessage);
        }

        abort_unless(json_validate($body), 502, $failureMessage);

        return $body;
    }
}
