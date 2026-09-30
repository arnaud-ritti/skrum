<?php

use App\Enums\IntegrationProvider;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

it('enables a provider only when its configuration is complete', function (IntegrationProvider $provider, array $config) {
    disableIntegrations();

    expect($provider->isEnabled())->toBeFalse()
        ->and(IntegrationProvider::enabled())->toBe([])
        ->and(IntegrationProvider::anyEnabled())->toBeFalse();

    foreach (array_keys($config) as $missingKey) {
        config([...$config, $missingKey => null]);

        expect($provider->isEnabled())->toBeFalse();
    }

    config($config);

    expect($provider->isEnabled())->toBeTrue()
        ->and(IntegrationProvider::enabled())->toBe([$provider])
        ->and(IntegrationProvider::anyEnabled())->toBeTrue();
})->with([
    'slack' => [IntegrationProvider::Slack, ['services.slack.client_id' => 'id', 'services.slack.client_secret' => 'secret']],
    'telegram' => [IntegrationProvider::Telegram, ['services.telegram.bot_token' => '1:token']],
    'jira' => [IntegrationProvider::Jira, ['services.jira.client_id' => 'id', 'services.jira.client_secret' => 'secret']],
    'linear' => [IntegrationProvider::Linear, ['services.linear.client_id' => 'id', 'services.linear.client_secret' => 'secret']],
]);

it('lists enabled providers in a fixed order', function () {
    enableIntegrations(IntegrationProvider::Linear, IntegrationProvider::Slack);

    expect(IntegrationProvider::enabled())->toBe([IntegrationProvider::Slack, IntegrationProvider::Linear]);
});

it('describes each provider', function () {
    expect(IntegrationProvider::Slack->label())->toBe('Slack')
        ->and(IntegrationProvider::Telegram->label())->toBe('Telegram')
        ->and(IntegrationProvider::Jira->label())->toBe('Jira')
        ->and(IntegrationProvider::Linear->label())->toBe('Linear')
        ->and(IntegrationProvider::Slack->usesOAuth())->toBeTrue()
        ->and(IntegrationProvider::Telegram->usesOAuth())->toBeFalse()
        ->and(IntegrationProvider::Jira->isTracker())->toBeTrue()
        ->and(IntegrationProvider::Linear->isTracker())->toBeTrue()
        ->and(IntegrationProvider::Slack->isTracker())->toBeFalse()
        ->and(IntegrationProvider::Telegram->isChannel())->toBeTrue()
        ->and(IntegrationProvider::Jira->isChannel())->toBeFalse();
});

it('offers email results only with a mailer that delivers', function (string $mailer, bool $expected) {
    config(['mail.default' => $mailer]);

    expect(app(IntegrationAvailability::class)->emailEnabled())->toBe($expected);
})->with([
    'log' => ['log', false],
    'array' => ['array', false],
    'smtp' => ['smtp', true],
    'ses' => ['ses', true],
]);

it('uses fixed OAuth callback URLs', function () {
    expect(config('services.slack.redirect'))->toEndWith('/integrations/slack/callback')
        ->and(config('services.jira.redirect'))->toEndWith('/integrations/jira/callback')
        ->and(config('services.linear.redirect'))->toEndWith('/integrations/linear/callback')
        ->and(config('services.slack.notifications'))->toBeArray();
});
