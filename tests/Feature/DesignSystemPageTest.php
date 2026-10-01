<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

it('shows the token section by default', function () {
    $this->get('/dev/design-system')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dev/design-system')
            ->where('section', 'tokens'));
});

it('shows a layout section', function (string $section) {
    $this->get("/dev/design-system/{$section}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('section', $section));
})->with(['app', 'session', 'settings', 'auth', 'onboarding']);

it('does not know other sections', function () {
    $this->get('/dev/design-system/nope')->assertNotFound();
});

it('opens for a guest and for a signed-in user', function () {
    $this->get('/dev/design-system')->assertOk();

    $this->actingAs(User::factory()->create())
        ->get('/dev/design-system')
        ->assertOk();
});

it('does not exist outside local and testing environments', function (string $path) {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get($path)->assertNotFound();
})->with(['/dev/design-system', '/dev/design-system/app']);
