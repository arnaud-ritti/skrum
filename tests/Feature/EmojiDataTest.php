<?php

use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    config(['services.emoji_data.version' => '17.0.0']);
});

function emojiDataUrl(string $locale, string $file, string $version = '17.0.0'): string
{
    return route('emoji-data.show', ['version' => $version, 'locale' => $locale, 'file' => $file]);
}

function emojiCdnResponse(string $body, int $status = 200): PromiseInterface
{
    return Http::response($body, $status, ['Content-Type' => 'application/json; charset=utf-8']);
}

it('fetches emoji data once from the cdn and then serves it from storage', function () {
    Http::fake(['cdn.jsdelivr.net/*' => emojiCdnResponse('[{"emoji":"👍"}]')]);

    $this->get(emojiDataUrl('fr', 'data.json'))
        ->assertOk()
        ->assertHeader('Content-Type', 'application/json')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('ETag', '"'.hash('xxh128', '[{"emoji":"👍"}]').'"')
        ->assertContent('[{"emoji":"👍"}]');

    $this->get(emojiDataUrl('fr', 'data.json'))->assertOk();

    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request->url() === 'https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/fr/data.json');
    Storage::assertExists('emoji-data/17.0.0/fr/data.json');
});

it('fetches again over an empty cached file', function () {
    Storage::put('emoji-data/17.0.0/en/data.json', '');
    Http::fake(['cdn.jsdelivr.net/*' => emojiCdnResponse('[{"emoji":"👍"}]')]);

    $this->get(emojiDataUrl('en', 'data.json'))->assertOk()->assertContent('[{"emoji":"👍"}]');

    Http::assertSentCount(1);
    expect(Storage::get('emoji-data/17.0.0/en/data.json'))->toBe('[{"emoji":"👍"}]');
});

it('answers head requests with the etag used for revalidation', function () {
    Storage::put('emoji-data/17.0.0/en/messages.json', '{"groups":[]}');
    Http::fake();

    $this->call('HEAD', emojiDataUrl('en', 'messages.json'))
        ->assertOk()
        ->assertHeader('ETag', '"'.hash('xxh128', '{"groups":[]}').'"');

    Http::assertNothingSent();
});

it('refuses unknown versions, locales and files', function (string $version, string $locale, string $file) {
    Http::fake();

    $this->get(emojiDataUrl($locale, $file, $version))->assertNotFound();

    Http::assertNothingSent();
})->with([
    'other version' => ['16.0.0', 'en', 'data.json'],
    'locale skrum does not ship' => ['17.0.0', 'ja', 'data.json'],
    'file frimousse never asks for' => ['17.0.0', 'en', 'compact.json'],
]);

it('answers 502 and stores nothing when the cdn reply is unusable', function (Closure $response) {
    Http::fake(['cdn.jsdelivr.net/*' => $response()]);

    $this->getJson(emojiDataUrl('de', 'data.json'))
        ->assertStatus(502)
        ->assertJsonPath('message', 'Emoji list unavailable');

    Storage::assertMissing('emoji-data/17.0.0/de/data.json');
})->with([
    'server error' => [fn () => emojiCdnResponse('down', 500)],
    'body that is not json' => [fn () => emojiCdnResponse('<html>')],
    'html content type' => [fn () => Http::response('[]', 200, ['Content-Type' => 'text/html'])],
    'missing content type' => [fn () => Http::response('[]')],
    'body over the size cap' => [fn () => emojiCdnResponse('["'.str_repeat('a', 10 * 1024 * 1024).'"]')],
]);

it('keeps serving cached data while the cdn is down', function () {
    Storage::put('emoji-data/17.0.0/es/data.json', '[]');
    Http::fake(['cdn.jsdelivr.net/*' => emojiCdnResponse('down', 500)]);

    $this->get(emojiDataUrl('es', 'data.json'))->assertOk();
});
