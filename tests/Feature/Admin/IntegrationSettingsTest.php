<?php

use App\Enums\AuditAction;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\AuditEvent;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    withEnvironmentConfiguration(['services.slack.client_id' => 'id', 'services.slack.client_secret' => 'slack-env-secret', 'services.linear.client_id' => null, 'services.linear.client_secret' => null]);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
});

it('lists every provider with its state, its fields and the teams that use it', function () {
    TeamIntegration::factory()->count(2)->create(['provider' => IntegrationProvider::Slack]);
    TeamIntegration::factory()->create(['provider' => IntegrationProvider::Slack, 'status' => IntegrationStatus::ReconnectRequired]);

    $response = $this->get(route('admin.integrations.edit'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/integrations')
        ->where('confirmUrl', route('admin.integrationConfirmation.create'))
        ->whereNot('confirmedUntil', null));
    $providers = collect($response->inertiaProps('providers'))->keyBy('key');

    expect($providers['slack']['configured'])->toBeTrue()
        ->and($providers['slack']['enabled'])->toBeTrue()
        ->and($providers['slack']['connectedTeams'])->toBe(2)
        ->and($providers['slack']['fields']['client_secret']['secretSet'])->toBeTrue()
        ->and($providers['slack']['callbackUrl'])->toBe(config('services.slack.redirect'))
        ->and($providers['slack']['updateUrl'])->toBe(route('admin.integrationApps.update', 'slack'))
        ->and($providers['linear']['webhookUrl'])->toBe(route('integrations.webhooks.store', 'linear'))
        ->and($response->getContent())->not->toContain('slack-env-secret');
});

it('gives the stored list of providers turned off, an unconfigured one included', function () {
    $this->put(route('admin.integrations.update'), ['disabled' => ['slack', 'linear']]);

    $this->get(route('admin.integrations.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('disabled', ['linear', 'slack']));
});

it('turns a configured provider off and on, keeping the team integrations', function () {
    $integration = TeamIntegration::factory()->create(['provider' => IntegrationProvider::Slack]);

    $this->put(route('admin.integrations.update'), ['disabled' => ['slack']])->assertRedirect();
    expect(IntegrationProvider::Slack->isEnabled())->toBeFalse();
    $this->get(route('integrations.callback', 'slack'))->assertNotFound();

    $this->put(route('admin.integrations.update'), ['disabled' => []]);
    expect(IntegrationProvider::Slack->isEnabled())->toBeTrue()
        ->and($integration->fresh())->not->toBeNull()
        ->and(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->oldest()->orderBy('id')->first()->properties)->toBeIgnoringKeyOrder(['section' => 'integrations', 'keys' => ['disabled_integrations'], 'disabled' => ['slack']]);
});

it('counts the enabled and the configured providers for the navigation of the instance admins only', function () {
    $configured = count(array_filter(IntegrationProvider::cases(), fn (IntegrationProvider $provider): bool => $provider->isConfigured()));

    $this->put(route('admin.integrations.update'), ['disabled' => ['slack']]);

    $this->get(route('admin.integrations.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('integrationCounts', ['enabled' => $configured - 1, 'configured' => $configured]));
    $this->actingAs(User::factory()->create())->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('integrationCounts', null));
});

it('keeps a provider that is not configured off when the admin turns every provider on', function () {
    $this->put(route('admin.integrations.update'), ['disabled' => ['linear']])->assertSessionHasNoErrors();

    $this->put(route('admin.integrations.update'), ['disabled' => []])
        ->assertRedirect(route('admin.integrations.edit'))
        ->assertSessionHasNoErrors();
    $linear = collect($this->get(route('admin.integrations.edit'))->inertiaProps('providers'))->firstWhere('key', 'linear');

    expect(resolve(InstanceSettings::class)->disabledIntegrations())->toBeEmpty()
        ->and(IntegrationProvider::Linear->isEnabled())->toBeFalse()
        ->and($linear['configured'])->toBeFalse()
        ->and($linear['enabled'])->toBeFalse();
});

it('refuses an unknown provider in the list of turned-off providers', function () {
    $this->put(route('admin.integrations.update'), ['disabled' => ['myspace']])->assertSessionHasErrors('disabled.0');
});

it('configures a provider from its app credentials, for requests and for queued jobs, without mailing the admins', function () {
    Mail::fake();

    $this->put(route('admin.integrationApps.update', 'linear'), ['client_id' => 'linear-id', 'client_secret' => 'linear-secret', 'webhook_secret' => 'linear-hook'])
        ->assertRedirect(route('admin.integrations.edit'));

    $linear = collect($this->get(route('admin.integrations.edit'))->inertiaProps('providers'))->firstWhere('key', 'linear');

    expect($linear['configured'])->toBeTrue();
    config(['services.linear.client_id' => null, 'services.linear.client_secret' => null]);
    event(new JobProcessing('database', Mockery::mock(Job::class)->shouldIgnoreMissing()));
    expect(IntegrationProvider::Linear->isConfigured())->toBeTrue();
    Mail::assertNothingSent();
    expect(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->sole()->properties['section'])->toBe('integration_linear');
});
