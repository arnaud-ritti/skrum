<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Retro;
use App\Support\Gifs\GiphyProvider;
use App\Support\Gifs\TenorProvider;
use Illuminate\Cache\Events\KeyWritten;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Event::fake();
    Storage::fake();
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
});

function giphyItem(string $id): array
{
    return [
        'id' => $id,
        'images' => [
            'fixed_width' => ['url' => "https://media.giphy.com/{$id}/200w.gif", 'webp' => "https://media.giphy.com/{$id}/200w.webp", 'width' => '200', 'height' => '150'],
            'original' => ['url' => "https://media.giphy.com/{$id}/giphy.gif", 'webp' => "https://media.giphy.com/{$id}/giphy.webp", 'width' => '480', 'height' => '360'],
        ],
    ];
}

it('searches gifs through the server without exposing the provider', function () {
    Http::fake(['api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123')]])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $response = $this->actingAs($user)
        ->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))
        ->assertOk()
        ->assertJsonPath('gifs.0.id', 'abc123')
        ->assertJsonPath('gifs.0.previewUrl', route('gifs.show', ['gif' => 'abc123', 'size' => 'preview'], false));

    expect($response->getContent())->not->toContain('secret-key')->not->toContain('giphy.com');

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();

    Http::assertSentCount(1);
});

it('writes nothing to the cache when a search is answered from it', function () {
    Http::fake(['api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123'), giphyItem('def456')]])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();
    Event::fake([KeyWritten::class]);

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();

    Event::assertNotDispatched(KeyWritten::class, fn (KeyWritten $event): bool => str_starts_with($event->key, 'gifs:'));
});

it('returns trending gifs for an empty query', function () {
    Http::fake(['api.giphy.com/v1/gifs/trending*' => Http::response(['data' => [giphyItem('hot1')]])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.gifs.index', $retro))->assertOk()->assertJsonPath('gifs.0.id', 'hot1');
});

it('hides gif search without a provider and refuses it when not editable', function (?string $provider, RetroPhase $phase, array $attributes, int $status) {
    config(['services.gifs.provider' => $provider]);
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.gifs.index', $retro))->assertStatus($status);
})->with([
    'no provider' => [null, RetroPhase::Writing, [], 404],
    'voting' => ['giphy', RetroPhase::Voting, [], 403],
    'turned off' => ['giphy', RetroPhase::Writing, ['gifs_enabled' => false], 403],
    'locked' => ['giphy', RetroPhase::Grouping, ['is_locked' => true], 423],
]);

it('rate limits gif searches per participant', function () {
    Http::fake(['api.giphy.com/*' => Http::response(['data' => []])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    [$other] = retroMember($retro);

    foreach (range(1, 20) as $attempt) {
        $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => "q{$attempt}"]))->assertOk();
    }

    $user->update(['locale' => 'fr']);

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'one more']))
        ->assertTooManyRequests()
        ->assertJsonPath('message', 'Trop de recherches, patiente un instant.');
    $this->actingAs($other)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'one more']))->assertOk();
});

it('answers 502 when the provider is down', function () {
    Http::fake(['api.giphy.com/*' => Http::response('down', 500)]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'x']))
        ->assertStatus(502)
        ->assertJsonPath('message', 'GIF search is unavailable.');
});

it('streams known gifs from a local cache and refuses unknown ones', function () {
    Http::fake([
        'api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123')]]),
        'media.giphy.com/*' => Http::response("GIF89a\x01\x00\x01\x00", 200, ['Content-Type' => 'image/webp']),
    ]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();

    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/gif')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');
    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))->assertOk();

    Http::assertSentCount(2);

    $this->get(route('gifs.show', ['gif' => 'zzz', 'size' => 'full']))->assertNotFound();
});

it('fetches a gif again over an empty cached file', function () {
    Http::fake([
        'api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123')]]),
        'media.giphy.com/*' => Http::response("GIF89a\x01\x00\x01\x00", 200, ['Content-Type' => 'image/gif']),
    ]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();
    Storage::put('gifs/giphy/abc123-preview', '');

    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/gif')
        ->assertContent("GIF89a\x01\x00\x01\x00");

    expect(Storage::get('gifs/giphy/abc123-preview'))->toBe("GIF89a\x01\x00\x01\x00");
});

it('attaches a gif to a card and keeps text optional', function () {
    Http::fake(['api.giphy.com/v1/gifs/abc123*' => Http::response(['data' => giphyItem('abc123')])]);
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'abc123'])
        ->assertCreated()
        ->assertJsonPath('card.content', null)
        ->assertJsonPath('card.hidden', false)
        ->assertJsonPath('card.gif.id', 'abc123')
        ->assertJsonPath('card.gif.url', route('gifs.show', ['gif' => 'abc123', 'size' => 'full'], false));

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id])
        ->assertUnprocessable();
});

it('keeps the stored gif when a card is edited without gif_id', function () {
    config(['services.gifs.provider' => null]);
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'gif_id' => 'abc123']);

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $card]), ['content' => 'edited'])
        ->assertOk();

    expect($card->fresh())->content->toBe('edited')->gif_id->toBe('abc123');
});

it('refuses unknown gifs and gifs when turned off', function () {
    Http::fake(['api.giphy.com/*' => Http::response(['data' => []], 404)]);
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'nope'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['gif_id' => 'This GIF could not be found.']);

    $retro->update(['gifs_enabled' => false]);

    $this->actingAs($user)
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'gif_id' => 'nope'])
        ->assertForbidden();
});

it('removes a gif but keeps a card with text or a gif', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => null, 'gif_id' => 'abc123']);

    $this->actingAs($user)->patchJson(route('retros.cards.update', [$retro, $card]), ['gif_id' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['content' => 'A card needs text or a GIF.']);

    $this->actingAs($user)->patchJson(route('retros.cards.update', [$retro, $card]), ['gif_id' => null, 'content' => 'Words'])
        ->assertOk()
        ->assertJsonPath('card.gif', null);
});

it('answers 502 when a gif image cannot be fetched', function () {
    Http::fake([
        'api.giphy.com/v1/gifs/search*' => Http::response(['data' => [giphyItem('abc123')]]),
        'media.giphy.com/*' => Http::response('down', 500),
    ]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))->assertOk();

    $this->getJson(route('gifs.show', ['gif' => 'abc123', 'size' => 'full']))
        ->assertStatus(502)
        ->assertJsonPath('message', 'This GIF could not be loaded.');

    Storage::assertMissing('gifs/giphy/abc123-full');
});

it('streams gifs used by a card from urls the provider returned', function () {
    Http::fake([
        'api.giphy.com/v1/gifs/abc123*' => Http::response(['data' => giphyItem('abc123')]),
        'media.giphy.com/*' => Http::response("GIF89a\x01\x00\x01\x00", 200, ['Content-Type' => 'image/gif']),
    ]);
    Card::factory()->create(['content' => null, 'gif_id' => 'abc123']);

    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'full']))->assertOk();

    Http::assertSent(fn ($request) => $request->url() === 'https://media.giphy.com/abc123/giphy.webp');
});

it('refuses gif paths outside the allowed ids and sizes', function (string $path) {
    Http::fake();

    $this->get($path)->assertNotFound();

    Http::assertNothingSent();
})->with([
    'traversal' => ['/gifs/..%2Fsecrets/preview'],
    'url as id' => ['/gifs/https%3A%2F%2Fevil.test/preview'],
    'unknown size' => ['/gifs/abc123/original'],
]);

it('never leaks the provider key when the provider cannot be reached', function () {
    Exceptions::fake();
    Http::fake(['api.giphy.com/*' => Http::failedConnection()]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    Card::factory()->create(['content' => null, 'gif_id' => 'abc123']);

    $search = $this->actingAs($user)->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'x']))->assertStatus(502);
    $proxy = $this->getJson(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))->assertStatus(502);

    expect($search->getContent())->not->toContain('secret-key')
        ->and($proxy->getContent())->not->toContain('secret-key');

    Exceptions::assertNothingReported();
});

it('refuses upstream images that are not gif or webp or exceed 5 MB', function (Closure $upstream) {
    Http::fake([
        'api.giphy.com/v1/gifs/abc123*' => Http::response(['data' => giphyItem('abc123')]),
        'media.giphy.com/*' => $upstream,
    ]);
    Card::factory()->create(['content' => null, 'gif_id' => 'abc123']);

    $this->getJson(route('gifs.show', ['gif' => 'abc123', 'size' => 'full']))
        ->assertStatus(502)
        ->assertJsonPath('message', 'This GIF could not be loaded.');

    expect(Storage::allFiles())->toBeEmpty();
})->with([
    'html' => [fn () => Http::response('<html><script>alert(1)</script></html>', 200, ['Content-Type' => 'text/html'])],
    'html labelled as gif' => [fn () => Http::response('<html><script>alert(1)</script></html>', 200, ['Content-Type' => 'image/gif'])],
    'declared too large' => [fn () => Http::response("GIF89a\x01\x00\x01\x00", 200, ['Content-Type' => 'image/gif', 'Content-Length' => (string) (5 * 1024 * 1024 + 1)])],
    'body too large' => [fn () => Http::response('GIF89a'.str_repeat("\x00", 5 * 1024 * 1024), 200, ['Content-Type' => 'image/gif'])],
]);

it('stores gifs under the requested id', function () {
    Http::fake([
        'api.giphy.com/v1/gifs/abc123*' => Http::response(['data' => [...giphyItem('abc123'), 'id' => 'other']]),
        'media.giphy.com/*' => Http::response("GIF89a\x01\x00\x01\x00", 200, ['Content-Type' => 'image/gif']),
    ]);
    Card::factory()->create(['content' => null, 'gif_id' => 'abc123']);

    $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))->assertOk();

    Storage::assertExists('gifs/giphy/abc123-preview');
});

it('keeps the provider key out of stack traces', function (string $provider) {
    $key = new ReflectionMethod($provider, '__construct')->getParameters()[0];

    expect($key->getName())->toBe('key')
        ->and($key->getAttributes(SensitiveParameter::class))->toHaveCount(1);
})->with([GiphyProvider::class, TenorProvider::class]);
