<?php

use App\Enums\AuditAction;
use App\Enums\SsoProvider;
use App\Mail\InstanceConfigurationChangedMail;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    withEnvironmentConfiguration([
        'oidc.connections.generic.base_url' => 'https://auth.atlas.test/realms/atlas',
        'oidc.connections.generic.client_id' => 'skrum-prod',
        'oidc.connections.generic.client_secret' => 'very-secret-value',
        'services.google.client_id' => null,
        'services.google.client_secret' => null,
    ]);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
});

it('describes each provider with its sources and without any secret', function () {
    $response = $this->get(route('admin.signIn.edit'))->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->where('providerDetails.3.key', 'oidc')
        ->where('providerDetails.3.configured', true)
        ->where('providerDetails.3.fields.client_id.value', 'skrum-prod')
        ->where('providerDetails.3.fields.client_id.source', 'environment')
        ->where('providerDetails.3.fields.client_secret.secretSet', true)
        ->where('providerDetails.3.fields.client_secret.value', null)
        ->where('providerDetails.3.redirectUri', route('sso.callback', 'oidc'))
        ->where('providerDetails.3.testable', true)
        ->where('providerDetails.3.updateUrl', route('admin.ssoProviders.update', 'oidc'))
        ->where('providerDetails.0.configured', false)
        ->where('providerDetails.0.testable', false)
        ->where('confirmUrl', route('password.confirm'))
        ->where('lastTest', null)
        ->whereNot('confirmedUntil', null));
    expect($response->getContent())->not->toContain('very-secret-value');
});

it('shows no confirmation end once the confirmation is older than five minutes', function () {
    $this->withSession(['auth.password_confirmed_at' => now()->subSeconds(301)->unix()]);

    $this->get(route('admin.signIn.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('confirmedUntil', null));
});

it('S1: lets an instance admin store an issuer, a client id and a secret, used on the next request', function () {
    Mail::fake();

    $this->put(route('admin.ssoProviders.update', 'oidc'), [
        'base_url' => 'https://login.atlas.test/realms/atlas',
        'client_id' => 'skrum-stored',
        'client_secret' => 'stored-secret-value',
    ])->assertRedirect(route('admin.signIn.edit'))->assertInertiaFlash('toast.type', 'success');

    Auth::logout();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('ssoProviders.0.key', 'oidc'));
    expect(config('services.oidc_generic.base_url'))->toBe('https://login.atlas.test/realms/atlas')
        ->and(SsoProvider::Oidc->isEnabled())->toBeTrue();
    Mail::assertSent(InstanceConfigurationChangedMail::class);
    expect(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->sole()->properties['section'])->toBe('sso_oidc');
});

it('S6: keeps the stored secret when the field is left blank', function () {
    Mail::fake();
    $this->put(route('admin.ssoProviders.update', 'oidc'), ['client_secret' => 'stored-secret-value']);

    $this->put(route('admin.ssoProviders.update', 'oidc'), ['client_secret' => '', 'label' => 'Atlas SSO']);

    $this->get(route('admin.signIn.edit'));
    expect(config('services.oidc_generic.client_secret'))->toBe('stored-secret-value');
});

it('returns a field to the environment value', function () {
    Mail::fake();
    $this->put(route('admin.ssoProviders.update', 'oidc'), ['client_id' => 'skrum-stored']);

    $this->put(route('admin.ssoProviders.update', 'oidc'), ['clear' => ['client_id']]);

    $this->get(route('admin.signIn.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('providerDetails.3.fields.client_id.source', 'environment'));
});

it('says when there is nothing to save', function () {
    Mail::fake();

    $this->put(route('admin.ssoProviders.update', 'oidc'), ['client_id' => ''])
        ->assertRedirect(route('admin.signIn.edit'))
        ->assertInertiaFlash('toast.message', 'Nothing to save.');

    Mail::assertNothingSent();
});

it('refuses an issuer that is not https', function () {
    $this->put(route('admin.ssoProviders.update', 'oidc'), ['base_url' => 'http://login.atlas.test'])
        ->assertSessionHasErrors('base_url');
});

it('tests the discovery document of the values in force', function () {
    Mail::fake();
    $this->put(route('admin.ssoProviders.update', 'oidc'), ['base_url' => 'https://login.atlas.test/realms/atlas']);
    Http::fake(['login.atlas.test/*' => Http::response(['issuer' => 'https://login.atlas.test/realms/atlas', 'authorization_endpoint' => 'x', 'token_endpoint' => 'y'])]);

    $this->post(route('admin.ssoTests.store'), ['provider' => 'oidc'])
        ->assertRedirect()
        ->assertInertiaFlash('ssoTest.ok', true)
        ->assertInertiaFlash('ssoTest.issuer', 'https://login.atlas.test/realms/atlas');

    Http::assertSent(fn ($request) => $request->url() === 'https://login.atlas.test/realms/atlas/.well-known/openid-configuration');
    expect(AuditEvent::query()->where('action', AuditAction::SsoTested)->exists())->toBeTrue()
        ->and(resolve(InstanceSettings::class)->ssoLastTest())->toMatchArray(['provider' => 'oidc', 'ok' => true]);

    $this->get(route('admin.signIn.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('lastTest.provider', 'oidc')->where('lastTest.ok', true));
});

it('tests the discovery document of Microsoft Entra for its tenant', function () {
    withEnvironmentConfiguration([
        'oidc.connections.entra.tenant' => 'atlas-tenant',
        'oidc.connections.entra.client_id' => 'entra-client',
        'oidc.connections.entra.client_secret' => 'entra-secret',
    ]);
    Http::fake(['login.microsoftonline.com/*' => Http::response([
        'issuer' => 'https://login.microsoftonline.com/0f1e2d3c/v2.0',
        'authorization_endpoint' => 'x',
        'token_endpoint' => 'y',
    ])]);

    $this->post(route('admin.ssoTests.store'), ['provider' => 'entra'])->assertInertiaFlash('ssoTest.ok', true);

    Http::assertSent(fn ($request) => $request->url() === 'https://login.microsoftonline.com/atlas-tenant/v2.0/.well-known/openid-configuration');
});

it('reports an issuer that does not match and a failure', function (Closure $answer, string $error) {
    Http::fake(['auth.atlas.test/*' => $answer]);

    $this->post(route('admin.ssoTests.store'), ['provider' => 'oidc'])
        ->assertInertiaFlash('ssoTest.ok', false)
        ->assertInertiaFlash('ssoTest.error', $error);
})->with([
    [fn () => Http::response(['issuer' => 'https://evil.test', 'authorization_endpoint' => 'x', 'token_endpoint' => 'y']), 'issuer_mismatch'],
    [fn () => Http::response('', 500), 'unreachable'],
    [fn () => Http::response('not json'), 'not_oidc'],
]);

it('refuses to test a provider that is not configured or not testable', function (string $provider) {
    Http::fake();

    $this->post(route('admin.ssoTests.store'), ['provider' => $provider])->assertSessionHasErrors('provider');

    Http::assertNothingSent();
})->with(['google', 'github', 'entra']);

it('keeps the SSO section out of reach of a member', function () {
    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->put(route('admin.ssoProviders.update', 'oidc'), ['client_id' => 'skrum-stored'])->assertForbidden();
    $this->post(route('admin.ssoTests.store'), ['provider' => 'oidc'])->assertForbidden();
});
