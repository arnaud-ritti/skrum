<?php

use App\Enums\InstanceSettingKey;
use App\Enums\IntegrationProvider;
use App\Enums\SsoProvider;
use App\Models\InstanceSetting;
use App\Models\User;
use App\Providers\AppServiceProvider;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceConfiguration\InstanceConfigurationBaseline;
use App\Support\InstanceSettings;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Crypt;
use SocialiteProviders\OpenIDConnect\OpenIDConnectServiceProvider;

beforeEach(fn () => withEnvironmentConfiguration([
    'oidc.connections.generic.base_url' => 'https://env.atlas.test/realms/atlas',
    'oidc.connections.generic.client_id' => 'env-client',
    'oidc.connections.generic.client_secret' => 'env-secret-value',
]));

function storeSection(InstanceSettingKey $section, array $values, array $clear = []): void
{
    $merged = resolve(InstanceConfiguration::class)->merge($section, $values, $clear);
    resolve(InstanceSettings::class)->set($section->value, $merged['object']);
}

it('stores a secret encrypted and reads it back', function () {
    storeSection(InstanceSettingKey::SsoOidc, ['client_secret' => 'stored-secret-value']);

    $raw = InstanceSetting::query()->where('key', 'sso_oidc')->sole()->value['client_secret'];

    expect($raw)->not->toBe('stored-secret-value')
        ->and(Crypt::decryptString($raw))->toBe('stored-secret-value')
        ->and(resolve(InstanceConfiguration::class)->value(InstanceSettingKey::SsoOidc, 'client_secret'))->toBe('stored-secret-value');
});

it('falls back to the environment value field by field', function () {
    storeSection(InstanceSettingKey::SsoOidc, ['client_id' => 'stored-client']);
    $configuration = resolve(InstanceConfiguration::class);

    expect($configuration->value(InstanceSettingKey::SsoOidc, 'client_id'))->toBe('stored-client')
        ->and($configuration->value(InstanceSettingKey::SsoOidc, 'base_url'))->toBe('https://env.atlas.test/realms/atlas');
});

it('keeps the stored secret when the new one is blank, and clears a field on request', function () {
    storeSection(InstanceSettingKey::SsoOidc, ['client_id' => 'stored-client', 'client_secret' => 'stored-secret-value']);

    $merged = resolve(InstanceConfiguration::class)->merge(InstanceSettingKey::SsoOidc, ['client_secret' => '', 'client_id' => 'stored-client'], ['client_id']);

    expect(array_keys($merged['object']))->toBe(['client_secret'])
        ->and($merged['changed'])->toBe([])
        ->and($merged['cleared'])->toBe(['client_id']);
});

it('names only the fields whose value changes', function () {
    storeSection(InstanceSettingKey::SsoOidc, ['client_id' => 'stored-client', 'client_secret' => 'stored-secret-value']);

    $merged = resolve(InstanceConfiguration::class)->merge(InstanceSettingKey::SsoOidc, ['client_id' => 'stored-client', 'client_secret' => 'new-secret-value', 'label' => 'Atlas SSO'], []);

    expect($merged['changed'])->toBe(['client_secret', 'label']);
});

it('describes a section without any secret value', function () {
    storeSection(InstanceSettingKey::SsoOidc, ['client_id' => 'stored-client']);

    $description = resolve(InstanceConfiguration::class)->describe(InstanceSettingKey::SsoOidc);

    expect($description['client_id'])->toMatchArray(['value' => 'stored-client', 'source' => 'stored', 'envName' => 'OIDC_CLIENT_ID'])
        ->and($description['base_url']['source'])->toBe('environment')
        ->and($description['label']['source'])->toBe('none')
        ->and($description['client_secret'])->toMatchArray(['value' => null, 'secret' => true, 'secretSet' => true, 'source' => 'environment'])
        ->and(json_encode($description))->not->toContain('env-secret-value');
});

it('treats a secret encrypted under another key as not stored and says so', function () {
    $otherKey = new Encrypter(random_bytes(32), 'aes-256-cbc');
    resolve(InstanceSettings::class)->set('sso_oidc', ['client_secret' => $otherKey->encryptString('lost-secret')]);

    $configuration = resolve(InstanceConfiguration::class);

    expect($configuration->value(InstanceSettingKey::SsoOidc, 'client_secret'))->toBe('env-secret-value')
        ->and($configuration->describe(InstanceSettingKey::SsoOidc)['client_secret']['unreadable'])->toBeTrue();
});

it('refuses a value its kind does not accept', function (InstanceSettingKey $section, string $field, mixed $value) {
    expect(fn () => resolve(InstanceConfiguration::class)->merge($section, [$field => $value], []))
        ->toThrow(InvalidArgumentException::class);
})->with([
    'http issuer' => [InstanceSettingKey::SsoOidc, 'base_url', 'http://auth.atlas.test'],
    'port' => [InstanceSettingKey::Smtp, 'port', 70000],
    'mailer' => [InstanceSettingKey::Smtp, 'mailer', 'ses'],
    'unknown field' => [InstanceSettingKey::IntegrationSlack, 'signing_key', 'x'],
]);

it('has no field for the environment-only keys of rule S8', function () {
    expect(resolve(ConfigurationCatalogue::class)->configKeys())->not->toContain(
        'app.url',
        'services.outgoing_webhooks.allow_private_networks',
        'services.outgoing_webhooks.allow_http',
        'services.github_app.private_key_path',
        'services.integrations.inbound_webhooks',
        'services.integrations.poll_minutes',
        'services.slack.notifications.bot_user_oauth_token',
        'services.google.redirect',
    );
});

it('has a field list for every configuration section and maps each provider to its section', function () {
    $catalogue = resolve(ConfigurationCatalogue::class);

    foreach (InstanceSettingKey::configurationSections() as $section) {
        expect($catalogue->fields($section))->not->toBeEmpty();
    }

    foreach (SsoProvider::cases() as $provider) {
        expect($catalogue->ssoProvider($catalogue->section($provider)))->toBe($provider);
    }

    foreach (IntegrationProvider::cases() as $provider) {
        expect($catalogue->integrationProvider($catalogue->section($provider)))->toBe($provider);
    }

    expect($catalogue->alertsAdmins(InstanceSettingKey::Smtp))->toBeTrue()
        ->and($catalogue->alertsAdmins(InstanceSettingKey::SsoGoogle))->toBeTrue()
        ->and($catalogue->alertsAdmins(InstanceSettingKey::IntegrationSlack))->toBeFalse()
        ->and($catalogue->configKeys())->toContain('mail.mailers.smtp.url');
});

it('leaves a stored configuration section in place on a branding reset', function () {
    storeSection(InstanceSettingKey::Smtp, ['host' => 'smtp.atlas.test']);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->delete(route('admin.branding.destroy'));

    expect(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::Smtp))->toHaveKey('host');
});

it('captures the environment of the OIDC drivers after the package copied it', function () {
    expect(resolve(InstanceConfigurationBaseline::class)->get('services.oidc_generic.client_id'))
        ->toBe('env-client');
});

it('boots the OIDC package before the provider that captures the baseline', function () {
    $providers = array_keys(app()->getLoadedProviders());

    expect(array_search(OpenIDConnectServiceProvider::class, $providers, true))
        ->toBeLessThan(array_search(AppServiceProvider::class, $providers, true));
});
