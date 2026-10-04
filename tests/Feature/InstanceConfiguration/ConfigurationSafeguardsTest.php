<?php

use App\Actions\Admin\ConfigurationChange;
use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Mail\InstanceConfigurationChangedMail;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\Auth\PasswordConfirmation;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Sleep;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    withEnvironmentConfiguration(['mail.default' => 'array', 'oidc.connections.generic.base_url' => null]);
    $this->admin = User::factory()->instanceAdmin()->create(['name' => 'Camille Roux', 'email' => 'camille@atlas.test']);
    $this->otherAdmin = User::factory()->instanceAdmin()->create();
    $this->formerAdmin = User::factory()->instanceAdmin()->deactivated()->create();
});

function updateConfiguration(User $admin, InstanceSettingKey $section, array $values, array $clear = []): ConfigurationChange
{
    return resolve(UpdateInstanceConfiguration::class)->handle($admin, $section, $values, $clear, '203.0.113.7');
}

it('S3: records one audit event with the field names and no value', function () {
    updateConfiguration($this->admin, InstanceSettingKey::SsoOidc, ['client_id' => 'skrum-prod', 'client_secret' => 'very-secret-value']);

    $event = AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->sole();

    expect($event->properties)->toBeIgnoringKeyOrder([
        'section' => 'sso_oidc', 'changed' => ['client_id', 'client_secret'], 'cleared' => [], 'alertSent' => true,
    ])
        ->and(json_encode(AuditEvent::query()->pluck('properties')))->not->toContain('skrum-prod')
        ->and(json_encode(AuditEvent::query()->pluck('properties')))->not->toContain('very-secret-value');
});

it('S4: mails every active instance admin once, naming the author and the fields, never a value', function () {
    Mail::fake();

    updateConfiguration($this->admin, InstanceSettingKey::SsoOidc, ['client_id' => 'skrum-prod', 'client_secret' => 'very-secret-value']);

    Mail::assertSent(InstanceConfigurationChangedMail::class, 2);
    Mail::assertSent(InstanceConfigurationChangedMail::class, fn ($mail) => $mail->hasTo($this->admin->email));
    Mail::assertSent(InstanceConfigurationChangedMail::class, fn ($mail) => $mail->hasTo($this->otherAdmin->email));
    Mail::assertNotSent(InstanceConfigurationChangedMail::class, fn ($mail) => $mail->hasTo($this->formerAdmin->email));

    $html = new InstanceConfigurationChangedMail($this->admin, InstanceSettingKey::SsoOidc, ['client_id', 'client_secret'], [], '2026-10-03T14:02:00+00:00', '203.0.113.7')->render();
    expect($html)->toContain('Camille Roux')->toContain('camille@atlas.test')->toContain('203.0.113.7')
        ->not->toContain('skrum-prod')->not->toContain('very-secret-value');
});

it('S4: sends the alert of an SMTP change through the mail configuration in force before it', function () {
    updateConfiguration($this->admin, InstanceSettingKey::Smtp, ['mailer' => 'smtp', 'host' => 'smtp.intruder.test', 'password' => 'smtp-secret-value']);

    $sentThroughPreviousMailer = resolve('mail.manager')->mailer('array')->getSymfonyTransport()->messages();

    expect($sentThroughPreviousMailer)->toHaveCount(2)
        ->and(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::Smtp))->toHaveKey('host');
});

it('S4: keeps the change and records it when the alert cannot be sent', function () {
    Mail::shouldReceive('to->locale->send')->andThrow(new RuntimeException('mailer down'));

    $change = updateConfiguration($this->admin, InstanceSettingKey::Smtp, ['host' => 'smtp.atlas.test']);

    expect($change->alertSent)->toBeFalse()
        ->and(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::Smtp))->toHaveKey('host')
        ->and(AuditEvent::query()->sole()->properties['alertSent'])->toBeFalse();
});

it('S4: mails nobody for an integration app, which is audited', function () {
    Mail::fake();

    updateConfiguration($this->admin, InstanceSettingKey::IntegrationSlack, ['client_id' => 'id', 'client_secret' => 'slack-secret']);

    Mail::assertNothingSent();
    expect(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->exists())->toBeTrue();
});

it('records nothing and mails nobody when nothing changes', function () {
    Mail::fake();

    $change = updateConfiguration($this->admin, InstanceSettingKey::SsoOidc, ['client_secret' => '']);

    expect($change->isEmpty())->toBeTrue()->and(AuditEvent::query()->count())->toBe(0);
    Mail::assertNothingSent();
});

it('refuses a value the catalogue does not accept and stores nothing', function () {
    expect(fn () => updateConfiguration($this->admin, InstanceSettingKey::Smtp, ['port' => 'not-a-port']))
        ->toThrow(ValidationException::class)
        ->and(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::Smtp))->toBeEmpty()
        ->and(AuditEvent::query()->count())->toBe(0);
});

it('refuses an allowed host that is not a host name', function (string $host) {
    expect(fn () => updateConfiguration($this->admin, InstanceSettingKey::IntegrationMicrosoftTeams, ['allowed_hosts' => ['atlas.webhook.office.com', $host]]))
        ->toThrow(ValidationException::class)
        ->and(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::IntegrationMicrosoftTeams))->toBeEmpty();
})->with(['evil.test/path', '*', 'http://x', 'localhost']);

it('stores allowed host names folded and unique', function () {
    updateConfiguration($this->admin, InstanceSettingKey::IntegrationMicrosoftTeams, ['allowed_hosts' => ['Atlas.Webhook.Office.com', 'atlas.webhook.office.com']]);

    expect(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::IntegrationMicrosoftTeams))
        ->toBe(['allowed_hosts' => ['atlas.webhook.office.com']]);
});

it('answers with a validation message when another admin keeps the section locked', function () {
    Sleep::fake(syncWithCarbon: true);
    $heldLock = Cache::lock('instance-configuration:smtp', 10);
    $heldLock->get();

    try {
        updateConfiguration($this->admin, InstanceSettingKey::Smtp, ['host' => 'smtp.atlas.test']);
        $this->fail('The save was not refused.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey('section');
    } finally {
        $heldLock->release();
    }

    expect(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::Smtp))->toBeEmpty();
});

it('S9: refuses a change that leaves no SSO provider while SSO is required', function () {
    updateConfiguration($this->admin, InstanceSettingKey::SsoOidc, [
        'base_url' => 'https://auth.atlas.test/realms/atlas', 'client_id' => 'skrum-prod', 'client_secret' => 'very-secret-value',
    ]);
    resolve(InstanceSettings::class)->set('sso_required', true);

    expect(fn () => updateConfiguration($this->admin, InstanceSettingKey::SsoOidc, [], ['client_id']))
        ->toThrow(ValidationException::class)
        ->and(resolve(InstanceSettings::class)->configuration(InstanceSettingKey::SsoOidc))->toHaveKey('client_id');
});

it('S2: counts a confirmation as fresh for 300 seconds only', function (int $age, bool $fresh) {
    $request = Request::create('/');
    $request->setLaravelSession($session = resolve('session.store'));
    $session->put('auth.password_confirmed_at', now()->subSeconds($age)->unix());

    expect(resolve(PasswordConfirmation::class)->isFresh($request, InstanceConfiguration::ConfirmationSeconds))
        ->toBe($fresh);
})->with([[299, true], [301, false]]);
