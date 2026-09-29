<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class EmojiDataController extends Controller
{
    /** App locale => Emojibase locale. */
    public const EmojibaseLocales = [
        'en' => 'en',
        'fr' => 'fr',
        'es' => 'es',
        'de' => 'de',
    ];

    private const Files = ['data.json', 'messages.json'];

    private const MaxBytes = 10 * 1024 * 1024;

    public static function emojibaseLocale(string $appLocale): string
    {
        return self::EmojibaseLocales[$appLocale] ?? 'en';
    }

    public function show(string $version, string $locale, string $file): Response
    {
        abort_unless($version === config('services.emoji_data.version'), 404);
        abort_unless(in_array($locale, self::EmojibaseLocales, true), 404);
        abort_unless(in_array($file, self::Files, true), 404);

        $disk = Storage::disk();
        $path = "emoji-data/{$version}/{$locale}/{$file}";

        if (! $disk->exists($path)) {
            $disk->put($path, $this->download($version, $locale, $file));
        }

        $body = (string) $disk->get($path);

        return response($body, 200, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'ETag' => '"'.md5($body).'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * The body is read in chunks so an oversized upstream file is refused
     * without being held in memory in full.
     */
    private function download(string $version, string $locale, string $file): string
    {
        $failureMessage = __('Emoji list unavailable');

        try {
            $response = Http::timeout(10)
                ->withOptions(['stream' => true])
                ->get("https://cdn.jsdelivr.net/npm/emojibase-data@{$version}/{$locale}/{$file}")
                ->throw();
        } catch (RequestException|ConnectionException) {
            abort(502, $failureMessage);
        }

        $declaredType = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));

        abort_unless($declaredType === 'application/json', 502, $failureMessage);
        abort_if((int) $response->header('Content-Length') > self::MaxBytes, 502, $failureMessage);

        $stream = $response->toPsrResponse()->getBody();
        $body = '';

        while (! $stream->eof() && strlen($body) <= self::MaxBytes) {
            $body .= $stream->read(65536);
        }

        abort_if(strlen($body) > self::MaxBytes, 502, $failureMessage);
        abort_unless(json_validate($body), 502, $failureMessage);

        return $body;
    }
}
