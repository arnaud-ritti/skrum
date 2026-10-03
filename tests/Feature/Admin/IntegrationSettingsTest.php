<?php

use App\Enums\AuditAction;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\AuditEvent;
use App\Models\TeamIntegration;
use App\Models\User;
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
        ->where('providers.0.key', 'slack')
        ->where('providers.0.configured', true)
        ->where('providers.0.enabled', true)
        ->where('providers.0.connectedTeams', 2)
        ->where('providers.0.fields.client_secret.secretSet', true)
        ->where('providers.0.callbackUrl', config('services.slack.redirect'))
        ->where('providers.0.updateUrl', route('admin.integrationApps.update', 'slack'))
        ->where('providers.3.webhookUrl', route('integrations.webhooks.store', 'linear'))
        ->where('confirmUrl', route('admin.integrationConfirmation.create'))
        ->whereNot('confirmedUntil', null));

    expect($response->getContent())->not->toContain('slack-env-secret');
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
        ->and($integration->fresh())->not->toBeNull();
    expect(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->orderBy('created_at')->orderBy('id')->first()->properties)
        ->toBe(['section' => 'integrations', 'keys' => ['disabled_integrations'], 'disabled' => ['slack']]);
});

it('counts the enabled and the configured providers for the navigation of the instance admins only', function () {
    $configured = count(array_filter(IntegrationProvider::cases(), fn (IntegrationProvider $provider): bool => $provider->isConfigured()));

    $this->put(route('admin.integrations.update'), ['disabled' => ['slack']]);

    $this->get(route('admin.integrations.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('integrationCounts', ['enabled' => $configured - 1, 'configured' => $configured]));
    $this->actingAs(User::factory()->create())->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('integrationCounts', null));
});

it('refuses to turn on a provider that is not configured', function () {
    expect(IntegrationProvider::Linear->isEnabled())->toBeFalse();

    $this->put(route('admin.integrations.update'), ['disabled' => []]);

    expect(IntegrationProvider::Linear->isEnabled())->toBeFalse();
});

it('refuses an unknown provider in the list of turned-off providers', function () {
    $this->put(route('admin.integrations.update'), ['disabled' => ['myspace']])->assertSessionHasErrors('disabled.0');
});

it('configures a provider from its app credentials, for requests and for queued jobs, without mailing the admins', function () {
    Mail::fake();

    $this->put(route('admin.integrationApps.update', 'linear'), ['client_id' => 'linear-id', 'client_secret' => 'linear-secret', 'webhook_secret' => 'linear-hook'])
        ->assertRedirect(route('admin.integrations.edit'));

    $this->get(route('admin.integrations.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('providers.3.configured', true));
    config(['services.linear.client_id' => null, 'services.linear.client_secret' => null]);
    event(new JobProcessing('database', Mockery::mock(Job::class)->shouldIgnoreMissing()));
    expect(IntegrationProvider::Linear->isConfigured())->toBeTrue();
    Mail::assertNothingSent();
    expect(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->sole()->properties['section'])->toBe('integration_linear');
});
