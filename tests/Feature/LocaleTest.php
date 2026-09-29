<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('defaults to english', function () {
    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});

it('uses the accept-language header', function () {
    $this->get(route('login'), ['Accept-Language' => 'de-DE,de;q=0.9,en;q=0.5'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'de'));
});

it('prefers the locale cookie over the header', function () {
    $this->withCookie('locale', 'es')
        ->get(route('login'), ['Accept-Language' => 'de'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'es'));
});

it('prefers the user locale over the cookie', function () {
    $user = User::factory()->create(['locale' => 'fr']);

    $this->actingAs($user)
        ->withCookie('locale', 'es')
        ->get(route('appearance.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'fr'));
});

it('falls back to english for unsupported values', function () {
    $user = User::factory()->create(['locale' => 'xx']);

    $this->actingAs($user)
        ->withCookie('locale', 'zz')
        ->get(route('appearance.edit'), ['Accept-Language' => 'ja-JP'])
        ->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
});

it('shares the active locale translations', function () {
    $this->withCookie('locale', 'fr')
        ->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('translations.Language', 'Langue')
            ->where('locales', ['en', 'fr', 'es', 'de']));
});

it('lets a visitor switch language with a cookie', function () {
    $this->put(route('locale.update'), ['locale' => 'de'])
        ->assertRedirect()
        ->assertCookie('locale', 'de');
});

it('stores the language of a logged in user', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->put(route('locale.update'), ['locale' => 'es']);

    expect($user->fresh()->locale)->toBe('es');
});

it('rejects unsupported languages', function () {
    $this->put(route('locale.update'), ['locale' => 'xx'])
        ->assertSessionHasErrors('locale');
});

it('shows validation errors in the active locale', function () {
    $this->withCookie('locale', 'fr')
        ->post(route('register.store'), [])
        ->assertSessionHasErrors('email');

    expect(session('errors')->first('email'))->toContain('obligatoire');
});
