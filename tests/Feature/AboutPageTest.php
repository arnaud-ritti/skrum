<?php

use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    config([
        'app.name' => 'Skrüm',
        'skrum.version' => '4.2.0',
        'skrum.avatar_style' => 'thumbs',
        'services.gifs' => ['provider' => null, 'key' => null, 'rating' => 'g'],
    ]);
});

/**
 * @param  array<string, mixed>  $settings
 */
function aboutPageWith(array $settings = []): AssertableInertia
{
    resolve(InstanceSettings::class)->setMany($settings);

    $page = null;

    test()->actingAs(User::factory()->create())
        ->get(route('about.show'))
        ->assertOk()
        ->assertInertia(function (AssertableInertia $inertia) use (&$page): void {
            $page = $inertia->component('about');
        });

    return $page;
}

it('redirects a guest to the login page', function () {
    $this->get(route('about.show'))->assertRedirect(route('login'));
});

it('sends an unverified user to the verification notice', function () {
    $this->actingAs(User::factory()->unverified()->create())
        ->get(route('about.show'))
        ->assertRedirect(route('verification.notice'));
});

it('shows the product and no attribution on a default instance', function () {
    aboutPageWith()
        ->where('name', 'Skrüm')
        ->where('version', '4.2.0')
        ->where('poweredBy', true)
        ->where('attributions', ['avatarStyles' => [], 'gifProvider' => null]);
});

it('shows the display name and the powered-by choice of the instance', function () {
    aboutPageWith([
        InstanceSettingKey::DisplayName->value => 'Acme Retros',
        InstanceSettingKey::PoweredBy->value => false,
    ])
        ->where('name', 'Acme Retros')
        ->where('poweredBy', false);
});

it('credits the instance style when its licence asks for it', function () {
    aboutPageWith([InstanceSettingKey::AvatarStyle->value => 'micah'])
        ->where('attributions.avatarStyles', [[
            'style' => 'micah',
            'name' => 'Micah',
            'source' => 'Avatar Illustration System',
            'creator' => 'Micah Lanier',
            'license' => 'CC BY 4.0',
            'sourceUrl' => 'https://www.figma.com/community/file/829741575478342595',
        ]]);
});

it('credits the styles members chose, once each, when members may choose', function () {
    User::factory()->count(2)->create(['avatar_style' => 'fun-emoji']);
    User::factory()->create(['avatar_style' => 'adventurer']);
    User::factory()->create(['avatar_style' => 'rings']);
    User::factory()->create(['avatar_style' => 'no-such-style']);

    aboutPageWith([
        InstanceSettingKey::AvatarStyle->value => 'micah',
        InstanceSettingKey::AvatarMemberChoice->value => true,
    ])
        ->where('attributions.avatarStyles', fn ($styles) => collect($styles)->pluck('style')->all() === ['micah', 'adventurer', 'fun-emoji']
            && collect($styles)->firstWhere('style', 'fun-emoji')['creator'] === 'Davis Uche');
});

it('does not credit member styles while members may not choose', function () {
    User::factory()->create(['avatar_style' => 'fun-emoji']);

    aboutPageWith()->where('attributions.avatarStyles', []);
});

it('names the GIF provider only while GIFs are on', function (array $settings, ?string $expected) {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'about-gif-key', 'rating' => 'g']]);

    aboutPageWith($settings)->where('attributions.gifProvider', $expected);
})->with([
    'environment provider' => [[], 'giphy'],
    'stored provider' => [[InstanceSettingKey::GifProvider->value => 'tenor'], 'tenor'],
    'turned off' => [[InstanceSettingKey::GifEnabled->value => false], null],
]);

it('never sends the GIF key to the about page', function () {
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::GifProvider->value => 'giphy',
        InstanceSettingKey::GifKey->value => 'stored-about-gif-key',
    ]);

    $body = $this->actingAs(User::factory()->create())->get(route('about.show'))->assertOk()->getContent();

    expect($body)->not->toContain('stored-about-gif-key');
});

it('shares the version with a signed-in user only', function () {
    config(['skrum.version' => '1.8.2']);

    $this->get(route('login'))->assertInertia(fn (AssertableInertia $page) => $page->where('instanceVersion', null));

    $this->actingAs(User::factory()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('instanceVersion', '1.8.2'));
});

it('shares the update status with instance admins only', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('instanceVersionStatus', null));

    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('instanceVersionStatus.state', 'unknown'));
});
