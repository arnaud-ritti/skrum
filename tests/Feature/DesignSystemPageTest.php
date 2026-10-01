<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

it('lists every section file on the index, with the group the naming rule gives it', function () {
    $this->get('/dev/design-system')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dev/design-system')
            ->where('section', null)
            ->where('sections', function ($sections): bool {
                $names = collect($sections)->pluck('name');
                $files = collect(glob(resource_path('js/pages/dev/sections/*.tsx')))
                    ->map(fn (string $path) => basename($path, '.tsx'))
                    ->sort()
                    ->values();

                return $names->all() === $files->all()
                    && $names->contains('tokens')
                    && collect($sections)->every(fn (array $section) => in_array($section['group'], ['ui', 'skrum'], true));
            }));
});

it('shows a section that has a file', function (string $section) {
    $this->get("/dev/design-system/{$section}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dev/design-system')
            ->where('section', $section));
})->with(['tokens', 'app', 'session', 'settings', 'auth', 'onboarding']);

it('does not know a section without a file', function () {
    $this->get('/dev/design-system/nope')->assertNotFound();
});

it('refuses a section name that is not lowercase letters, digits and hyphens', function (string $section) {
    $this->get("/dev/design-system/{$section}")->assertNotFound();
})->with([
    'encoded traversal' => '..%2Ftokens',
    'encoded traversal out of the folder' => '..%2Fdesign-system',
    'double-encoded traversal' => '..%252Ftokens',
    'backslash traversal' => '..%5Ctokens',
    'dot segments' => '%2e%2e',
    'file name with its extension' => 'tokens.tsx',
    'other letter case' => 'Tokens',
    'null byte' => 'tokens%00',
    'trailing newline' => 'tokens%0A',
]);

it('opens for a guest and for a signed-in user', function (string $path) {
    $this->get($path)->assertOk();

    $this->actingAs(User::factory()->create())
        ->get($path)
        ->assertOk();
})->with(['/dev/design-system', '/dev/design-system/tokens']);

it('does not exist outside local and testing environments', function (string $path) {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get($path)->assertNotFound();
})->with(['/dev/design-system', '/dev/design-system/tokens', '/dev/design-system/app']);
