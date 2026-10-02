<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Testing\AssertableInertia as Assert;

function brokenSharedPropsRoute(): void
{
    Route::middleware('web')->get('/error-pages-probe/broken', function () {
        Inertia::share('teams', fn () => throw new RuntimeException('The teams cannot be read.'));

        return Inertia::render('about');
    });
}

function useProcessLocalMaintenanceMode(): void
{
    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']);
}

/**
 * Runs the callback while the default connection points at a closed port, then
 * gives the test its own connection back.
 */
function withUnreachableDatabase(Closure $callback): void
{
    $default = config('database.default');

    config([
        'database.connections.unreachable' => [...config("database.connections.{$default}"), 'host' => '127.0.0.1', 'port' => 1],
        'database.default' => 'unreachable',
    ]);

    try {
        $callback();
    } finally {
        config(['database.default' => $default]);
        DB::purge('unreachable');
    }
}

it('renders the 404 page for an unknown url', function (bool $signedIn) {
    $user = $signedIn ? teamMember(Team::factory()->create()) : null;

    if ($user !== null) {
        $this->actingAs($user);
    }

    $this->get('/no-such-page')
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('status', 404)
            ->when($user === null, fn (Assert $page) => $page->where('auth.user', null))
            ->when($user !== null, fn (Assert $page) => $page->where('auth.user.id', $user->id))
            ->missing('requestId')
            ->missing('retryAfter'));
})->with([
    'a guest' => false,
    'a signed-in user' => true,
]);

it('renders the 404 page in the language of the visitor', function () {
    $this->get('/no-such-page', ['Accept-Language' => 'fr'])
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('locale', 'fr'));
});

it('keeps the language of the visitor when the url names a session that is gone', function (string $path) {
    $user = teamMember(Team::factory()->create());
    $user->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($user)
        ->get($path)
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('locale', 'fr')
            ->where('translations.Language', 'Langue'));
})->with([
    'a retro' => fn () => '/retros/'.Str::uuid(),
    'a workspace' => '/w/no-such-workspace',
]);

it('keeps the language of the visitor on a throttled request', function () {
    Route::middleware(['web', 'throttle:1,1'])->get('/error-pages-probe/throttled-fr', fn () => 'ok');

    $this->get('/error-pages-probe/throttled-fr', ['Accept-Language' => 'fr'])->assertOk();

    app()->setLocale('en');

    $this->get('/error-pages-probe/throttled-fr', ['Accept-Language' => 'fr'])
        ->assertTooManyRequests()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('locale', 'fr'));
});

it('starts no session for an unknown url asked without one', function (array $headers) {
    $this->get('/build/assets/gone-chunk.js', $headers)
        ->assertNotFound()
        ->assertCookieMissing(config('session.cookie'));
})->with([
    'a first visit' => [[]],
    'an asset request' => [['Accept' => '*/*']],
]);

it('renders the 403 page when registration is closed', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    $this->get(route('register'))
        ->assertForbidden()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('status', 403)
            ->where('auth.user', null)
            ->missing('requestId'));
});

it('renders the 419 page for a post with a stale csrf token', function () {
    Route::middleware('web')->post('/error-pages-probe/expired', fn () => throw new TokenMismatchException('CSRF token mismatch.'));

    $this->post('/error-pages-probe/expired')
        ->assertStatus(419)
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('status', 419)
            ->missing('requestId'));
});

it('gives the error page of a request that was not a get the page to go back to', function (?string $referer, string $returnTo) {
    Route::middleware('web')->post('/error-pages-probe/expired', fn () => throw new TokenMismatchException('CSRF token mismatch.'));

    $this->post('/error-pages-probe/expired', [], $referer === null ? [] : ['Referer' => $referer])
        ->assertStatus(419)
        ->assertInertia(fn (Assert $page) => $page->where('returnTo', $returnTo));
})->with([
    'the page it came from' => ['http://localhost/settings/profile?tab=1', 'http://localhost/settings/profile?tab=1'],
    'no referer' => [null, 'http://localhost'],
    'another site' => ['https://evil.example/x', 'http://localhost/'],
    'a host that only starts like ours' => ['http://localhost.evil.example/x', 'http://localhost/'],
]);

it('leaves the error page of a get to reload its own url', function () {
    Route::middleware('web')->get('/error-pages-probe/expired-get', fn () => throw new TokenMismatchException('CSRF token mismatch.'));

    $this->get('/error-pages-probe/expired-get', ['Referer' => 'http://localhost/settings/profile'])
        ->assertStatus(419)
        ->assertInertia(fn (Assert $page) => $page->missing('returnTo'));
});

it('renders the 429 page with the delay of a throttled request', function () {
    Route::middleware(['web', 'throttle:1,1'])->get('/error-pages-probe/throttled', fn () => 'ok');

    $this->get('/error-pages-probe/throttled')->assertOk();

    $this->get('/error-pages-probe/throttled')
        ->assertTooManyRequests()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('status', 429)
            ->where('retryAfter', fn (int $seconds): bool => $seconds > 0 && $seconds <= 60)
            ->missing('requestId'));
});

it('keeps the json body and status of a json request', function (int $status) {
    config(['app.debug' => false]);
    Route::middleware('web')->get('/error-pages-probe/json', fn () => abort($status, 'Refused by the probe.'));

    $this->getJson('/error-pages-probe/json')
        ->assertStatus($status)
        ->assertExactJson(['message' => 'Refused by the probe.']);
})->with([403, 404, 410, 419, 429]);

it('keeps the json answer of a live endpoint', function () {
    $this->actingAs(teamMember(Team::factory()->create()))
        ->getJson('/retros/'.Str::uuid().'/snapshot')
        ->assertNotFound()
        ->assertJsonStructure(['message'])
        ->assertHeaderMissing('X-Inertia');
});

it('answers an inertia visit with the error page', function () {
    $response = $this->get('/no-such-page', [
        'X-Inertia' => 'true',
        'X-Requested-With' => 'XMLHttpRequest',
        'Accept' => 'text/html, application/xhtml+xml',
    ]);

    $response->assertNotFound()->assertHeader('X-Inertia', 'true');

    expect($response->json('component'))->toBe('errors/error')
        ->and($response->json('props.status'))->toBe(404);
});

it('leaves a 500 to the framework in debug mode', function () {
    config(['app.debug' => true]);
    brokenSharedPropsRoute();

    $response = $this->get('/error-pages-probe/broken');

    $response->assertInternalServerError();
    expect($response->getContent())->toContain('The teams cannot be read.');
});

it('renders the 500 page with the request id when the shared props cannot be built', function () {
    config(['app.debug' => false]);
    brokenSharedPropsRoute();

    $response = $this->get('/error-pages-probe/broken', ['Accept-Language' => 'fr']);

    $response->assertInternalServerError()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('status', 500)
            ->where('requestId', $response->headers->get('X-Request-Id'))
            ->where('occurredAt', fn (string $moment): bool => preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D', $moment) === 1)
            ->where('locale', 'fr')
            ->where('translations.Language', 'Langue')
            ->missing('teams')
            ->missing('auth')
            ->missing('workspaces'));
});

it('still renders the page of another status when the shared props cannot be built', function () {
    app()->bind(HandleInertiaRequests::class, fn () => new class extends HandleInertiaRequests
    {
        public function share(Request $request): array
        {
            throw new RuntimeException('The shared props cannot be read.');
        }
    });

    $this->get('/no-such-page', ['Accept-Language' => 'fr'])
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('status', 404)
            ->where('locale', 'fr')
            ->has('translations')
            ->missing('auth')
            ->missing('requestId'));
});

it('renders the static 503 view while the database is unreachable', function () {
    Route::middleware('web')->get('/error-pages-probe/unavailable', fn () => abort(503));

    withUnreachableDatabase(function (): void {
        expect(fn () => DB::select('select 1'))->toThrow(PDOException::class);

        $this->get('/error-pages-probe/unavailable?from=probe', ['Accept-Language' => 'fr'])
            ->assertServiceUnavailable()
            ->assertSee('lang="fr"', false)
            ->assertSee('Réessayer maintenant')
            ->assertSee('href="/error-pages-probe/unavailable?from=probe"', false)
            ->assertSee('data-slot="maintenance-page"', false)
            ->assertSee("Cette page se recharge toute seule dès que l'instance répond.")
            ->assertDontSee('<script src', false)
            ->assertDontSee('data-page', false);
    });
});

it('keeps the retry link of the 503 view on the instance', function () {
    Route::middleware('web')->get('/{path}', fn () => abort(503))->where('path', '.*');

    $response = $this->get('http://localhost//evil.example/x?from=probe')->assertServiceUnavailable();

    expect($response->getContent())
        ->toContain('href="/evil.example/x?from=probe"')
        ->not->toContain('href="//');
});

it('gives the static 503 view one inline script, no external one, a hidden reload line and a probe of the home route', function () {
    Route::middleware('web')->get('/error-pages-probe/unavailable', fn () => abort(503));

    $content = $this->get('/error-pages-probe/unavailable')->assertServiceUnavailable()->getContent();

    expect(substr_count($content, '<script'))->toBe(1)
        ->and($content)->toContain('<script>')
        ->toContain('30000')
        ->toContain("fetch('/', { method: 'HEAD', redirect: 'manual'")
        ->toContain('status === 503')
        ->toContain('location.reload()')
        ->not->toContain('<script src')
        ->not->toContain('location.replace')
        ->toMatch('/<span class="reload" data-slot="maintenance-reload" hidden>/');
});

it('renders the static 503 view in maintenance mode', function () {
    useProcessLocalMaintenanceMode();

    $this->artisan('down')->assertSuccessful();

    try {
        $this->get('/', ['Accept-Language' => 'fr-FR,fr;q=0.9,en;q=0.8'])
            ->assertServiceUnavailable()
            ->assertSee('lang="fr"', false)
            ->assertSee('Réessayer maintenant')
            ->assertSee('data-slot="maintenance-page"', false)
            ->assertDontSee('<script src', false);

        $this->get('/')
            ->assertServiceUnavailable()
            ->assertSee('lang="en"', false)
            ->assertSee('This page reloads by itself as soon as the instance answers.')
            ->assertSee('Retry now');

        $this->call('HEAD', '/')->assertServiceUnavailable();
    } finally {
        $this->artisan('up');
    }
});

it('renders the 500 page without the message, the trace or the request data while the database is unreachable', function () {
    config(['app.debug' => false]);
    Route::middleware('web')->post('/error-pages-probe/failing', fn () => throw new RuntimeException('Secret detail of the failure.'));

    withUnreachableDatabase(function (): void {
        $response = $this->post('/error-pages-probe/failing', ['password' => 'hunter2-probe']);

        $response->assertInternalServerError()
            ->assertInertia(fn (Assert $page) => $page
                ->component('errors/error')
                ->where('status', 500)
                ->where('requestId', $response->headers->get('X-Request-Id'))
                ->missing('auth')
                ->missing('errors'));

        expect($response->getContent())
            ->not->toContain('Secret detail')
            ->not->toContain('RuntimeException')
            ->not->toContain('hunter2-probe')
            ->not->toContain(base_path());
    });
});

it('answers a refused webhook delivery, which has no session, without reporting a failure of the page', function () {
    Exceptions::fake();

    $this->post('/integrations/webhooks/github', [], ['Accept' => '*/*'])
        ->assertStatus(404);

    Exceptions::assertNothingReported();
});
