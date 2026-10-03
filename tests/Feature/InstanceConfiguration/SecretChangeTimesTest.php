<?php

use App\Actions\Admin\SecretChangeTimes;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

function configurationEvent(string $section, array $changed, DateTimeInterface $at): AuditEvent
{
    return AuditEvent::factory()->create([
        'action' => AuditAction::ConfigurationUpdated,
        'properties' => ['section' => $section, 'changed' => $changed, 'cleared' => [], 'alertSent' => true],
        'created_at' => $at,
    ]);
}

it('gives the time of the latest event that changed the secret of the section', function () {
    $this->freezeSecond();
    configurationEvent('sso_oidc', ['client_secret'], now()->subDays(12));
    configurationEvent('sso_oidc', ['label'], now()->subDay());
    configurationEvent('sso_entra', ['client_secret'], now());

    expect(resolve(SecretChangeTimes::class)->handle(InstanceSettingKey::SsoOidc, 'client_secret')?->toIso8601String())
        ->toBe(now()->subDays(12)->toIso8601String());
});

it('gives nothing when no event changed the secret', function () {
    configurationEvent('sso_oidc', ['client_id'], now());

    expect(resolve(SecretChangeTimes::class)->handle(InstanceSettingKey::SsoOidc, 'client_secret'))->toBeNull();
});

it('shows when a stored secret changed, and nothing for an environment or cleared secret', function () {
    Mail::fake();
    withEnvironmentConfiguration(['oidc.connections.entra.client_secret' => 'env-secret-value']);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
    $this->freezeSecond();

    $this->put(route('admin.ssoProviders.update', 'oidc'), ['client_secret' => 'stored-secret-value'])->assertSessionHasNoErrors();

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('providerDetails.3.key', 'oidc')
        ->where('providerDetails.3.secretChangedAt', now()->toIso8601String())
        ->where('providerDetails.2.key', 'entra')
        ->where('providerDetails.2.secretChangedAt', null));

    $this->put(route('admin.ssoProviders.update', 'oidc'), ['clear' => ['client_secret']])->assertSessionHasNoErrors();

    $this->get(route('admin.signIn.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('providerDetails.3.secretChangedAt', null));
});
