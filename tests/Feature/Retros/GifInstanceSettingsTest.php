<?php

use App\Enums\InstanceSettingKey;
use App\Models\Retro;
use App\Support\Gifs\GifCatalog;
use App\Support\InstanceSettings;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

const StoredGifKey = 'stored-instance-gif-key';

beforeEach(function () {
    Event::fake();
    Storage::fake();
    config(['services.gifs' => ['provider' => null, 'key' => null, 'rating' => null]]);
});

/**
 * @param  array<string, mixed>  $settings
 */
function storeGifSettings(array $settings = []): void
{
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::GifProvider->value => 'tenor',
        InstanceSettingKey::GifKey->value => StoredGifKey,
        ...$settings,
    ]);
}

function tenorItem(string $id): array
{
    return [
        'id' => $id,
        'media_formats' => [
            'tinygif' => ['url' => "https://media.tenor.com/{$id}/tiny.gif", 'dims' => [220, 160]],
            'gif' => ['url' => "https://media.tenor.com/{$id}/full.gif", 'dims' => [480, 360]],
        ],
    ];
}

it('searches with the stored provider, key and rating', function () {
    storeGifSettings([InstanceSettingKey::GifRating->value => 'pg-13']);
    Http::fake(['tenor.googleapis.com/*' => Http::response(['results' => [tenorItem('stored1')]])]);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $response = $this->actingAs($user)
        ->getJson(route('retros.gifs.index', ['retro' => $retro, 'q' => 'party']))
        ->assertOk()
        ->assertJsonPath('gifs.0.id', 'stored1');

    expect($response->getContent())->not->toContain(StoredGifKey);

    Http::assertSent(fn (HttpRequest $request): bool => str_contains($request->url(), 'tenor.googleapis.com')
        && $request['key'] === StoredGifKey
        && $request['contentfilter'] === 'low');
});

it('prefers the stored settings to the environment', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'environment-gif-key', 'rating' => 'r']]);
    storeGifSettings([InstanceSettingKey::GifRating->value => 'pg']);

    $catalog = resolve(GifCatalog::class);

    expect($catalog->providerName())->toBe('tenor')
        ->and($catalog->isAvailable())->toBeTrue();
});

it('asks for the g rating by default', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'environment-gif-key', 'rating' => null]]);
    Http::fake(['api.giphy.com/*' => Http::response(['data' => []])]);

    resolve(GifCatalog::class)->search('party');

    Http::assertSent(fn (HttpRequest $request): bool => $request['rating'] === 'g' && $request['api_key'] === 'environment-gif-key');
});

it('has no provider when GIFs are turned off or the key is missing', function (array $settings) {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => null, 'rating' => 'g']]);
    resolve(InstanceSettings::class)->setMany($settings);

    $catalog = resolve(GifCatalog::class);

    expect($catalog->provider())->toBeNull()
        ->and($catalog->providerName())->toBeNull()
        ->and($catalog->isAvailable())->toBeFalse()
        ->and($catalog->search('party'))->toBeEmpty();
})->with([
    'no key' => [[]],
    'turned off' => [[InstanceSettingKey::GifKey->value => StoredGifKey, InstanceSettingKey::GifEnabled->value => false]],
]);

it('hides GIFs from the retro page and its search once they are turned off', function () {
    storeGifSettings();
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $enabled = $this->actingAs($user)->get(route('retros.show', $retro))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('snapshot.retro.gifProvider', 'tenor'));

    storeGifSettings([InstanceSettingKey::GifEnabled->value => false]);

    $disabled = $this->actingAs($user)->get(route('retros.show', $retro))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('snapshot.retro.gifProvider', null));

    $search = $this->actingAs($user)->getJson(route('retros.gifs.index', $retro))->assertNotFound();
    $image = $this->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']))->assertNotFound();

    expect($enabled->getContent().$disabled->getContent().$search->getContent().$image->getContent())->not->toContain(StoredGifKey);
});

it('hides GIFs from the game page and its search once they are turned off', function () {
    storeGifSettings();
    [$room, $user] = sprintGifRoom();
    activeGifRound($room);

    $enabled = $this->actingAs($user)->get(route('games.show', $room))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('snapshot.round.gifProvider', 'tenor'));

    storeGifSettings([InstanceSettingKey::GifEnabled->value => false]);

    $disabled = $this->actingAs($user)->get(route('games.show', $room))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('snapshot.round.gifProvider', null));

    $search = $this->actingAs($user)->getJson(route('games.gifs.index', $room))->assertNotFound();

    expect($enabled->getContent().$disabled->getContent().$search->getContent())->not->toContain(StoredGifKey);
});

it('hides GIFs when the stored key is cleared and the environment has none', function () {
    storeGifSettings();
    resolve(InstanceSettings::class)->forget(InstanceSettingKey::GifKey->value);
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->get(route('retros.show', $retro))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('snapshot.retro.gifProvider', null));
});
