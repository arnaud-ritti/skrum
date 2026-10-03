<?php

use App\Enums\InstanceSettingKey;
use App\Enums\IntegrationProvider;
use App\Enums\SsoProvider;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceSettings;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Mail;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\NullOutput;

beforeEach(fn () => withEnvironmentConfiguration([
    'services.slack.client_id' => null,
    'services.slack.client_secret' => null,
    'oidc.connections.generic.base_url' => 'https://env.atlas.test/realms/atlas',
    'oidc.connections.generic.client_id' => 'env-client',
    'oidc.connections.generic.client_secret' => 'env-secret-value',
    'mail.default' => 'array',
]));

/**
 * @param  array<string, mixed>  $values
 * @param  array<int, string>  $clear
 */
function storeConfiguration(InstanceSettingKey $section, array $values, array $clear = []): void
{
    $merged = resolve(InstanceConfiguration::class)->merge($section, $values, $clear);
    resolve(InstanceSettings::class)->set($section->value, $merged['object']);
}

function fakeJobProcessing(): void
{
    event(new JobProcessing('database', Mockery::mock(Job::class)->shouldIgnoreMissing()));
}

it('applies stored fields on the next web request, and the login page offers the provider', function () {
    storeConfiguration(InstanceSettingKey::IntegrationSlack, ['client_id' => 'stored-id', 'client_secret' => 'stored-secret']);

    $this->get(route('login'))->assertOk();

    expect(config('services.slack.client_id'))->toBe('stored-id')
        ->and(IntegrationProvider::Slack->isConfigured())->toBeTrue();
});

it('gives the OIDC driver the stored issuer', function () {
    storeConfiguration(InstanceSettingKey::SsoOidc, ['base_url' => 'https://stored.atlas.test/realms/atlas']);

    resolve(InstanceConfiguration::class)->apply();

    expect(config('services.oidc_generic.base_url'))->toBe('https://stored.atlas.test/realms/atlas')
        ->and(SsoProvider::Oidc->isEnabled())->toBeTrue();
});

it('lets a queue worker see a change, and a clearing, between two jobs', function () {
    storeConfiguration(InstanceSettingKey::IntegrationSlack, ['client_id' => 'first-id', 'client_secret' => 's']);
    fakeJobProcessing();
    expect(config('services.slack.client_id'))->toBe('first-id');

    storeConfiguration(InstanceSettingKey::IntegrationSlack, [], ['client_id', 'client_secret']);
    fakeJobProcessing();

    expect(config('services.slack.client_id'))->toBeNull()
        ->and(config(InstanceConfiguration::AppliedKeys))->toBe([]);
});

it('applies the configuration when a console command starts', function () {
    storeConfiguration(InstanceSettingKey::Smtp, ['host' => 'smtp.stored.test']);

    event(new CommandStarting('skrum:heartbeat', new ArrayInput([]), new NullOutput));

    expect(config('mail.mailers.smtp.host'))->toBe('smtp.stored.test')
        ->and(config('mail.mailers.smtp.url'))->toBeNull();
});

it('does not reuse a mailer or a Socialite driver resolved before a change', function () {
    Mail::mailer('smtp');
    Socialite::driver('oidc_generic');
    storeConfiguration(InstanceSettingKey::Smtp, ['host' => 'smtp.stored.test']);
    storeConfiguration(InstanceSettingKey::SsoOidc, ['client_id' => 'stored-client']);

    resolve(InstanceConfiguration::class)->apply();

    expect(Mail::mailer('smtp')->getSymfonyTransport()->getStream()->getHost())->toBe('smtp.stored.test')
        ->and((fn (): mixed => $this->clientId)->call(Socialite::driver('oidc_generic')))->toBe('stored-client');
});

it('leaves the configuration of a test that set it directly alone', function () {
    config(['services.jira.client_id' => 'set-by-a-test']);

    $this->get(route('login'));

    expect(config('services.jira.client_id'))->toBe('set-by-a-test');
});

it('writes nothing into the configuration at boot', function () {
    storeConfiguration(InstanceSettingKey::IntegrationSlack, ['client_id' => 'stored-id', 'client_secret' => 's']);

    $this->refreshApplication();

    expect(config('services.slack.client_id'))->not->toBe('stored-id')
        ->and(config(InstanceConfiguration::AppliedKeys))->toBeNull();
});

it('renders the status page with an unreachable database', function () {
    withUnreachableDatabase(function (): void {
        $this->get('/status')->assertOk();
    });
});
