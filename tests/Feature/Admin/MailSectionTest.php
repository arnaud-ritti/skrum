<?php

use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Mail\InstanceConfigurationChangedMail;
use App\Mail\InstanceTestMail;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\Mailer\Exception\TransportException;

beforeEach(function () {
    withEnvironmentConfiguration([
        'mail.default' => 'smtp',
        'mail.mailers.smtp.host' => 'smtp.atlas.test',
        'mail.mailers.smtp.port' => 587,
        'mail.mailers.smtp.username' => 'skrum',
        'mail.mailers.smtp.password' => 'smtp-secret-value',
    ]);
    $this->admin = User::factory()->instanceAdmin()->create(['email' => 'arnaud@atlas.test']);
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('shows the mail configuration in force without the password', function () {
    $response = $this->get(route('admin.mail.show'))->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->component('admin/mail')
        ->where('mail.fields.host.value', 'smtp.atlas.test')
        ->where('mail.fields.host.source', 'environment')
        ->where('mail.fields.password.secretSet', true)
        ->where('mail.fields.password.value', null)
        ->where('mail.delivering', true)
        ->where('defaultRecipient', 'arnaud@atlas.test')
        ->where('lastTest', null)
        ->where('updateUrl', route('admin.mail.update'))
        ->where('confirmUrl', route('admin.mailConfirmation.create'))
        ->whereNot('confirmedUntil', null));
    expect($response->getContent())->not->toContain('smtp-secret-value');
});

it('says the instance does not deliver mails while they are written to the log', function () {
    withEnvironmentConfiguration(['mail.default' => 'log']);

    $this->get(route('admin.mail.show'))
        ->assertInertia(fn (Assert $page) => $page->where('mail.delivering', false));
});

it('shows no confirmation end once the confirmation is older than five minutes', function () {
    $this->withSession(['auth.password_confirmed_at' => now()->subSeconds(301)->unix()]);

    $this->get(route('admin.mail.show'))
        ->assertOk()
        ->assertSessionMissing('url.intended')
        ->assertInertia(fn (Assert $page) => $page->where('confirmedUntil', null));
});

it('returns to the mail section once the admin follows confirm', function () {
    $this->get(route('admin.mailConfirmation.create'))
        ->assertRedirect(route('password.confirm'))
        ->assertSessionHas('url.intended', route('admin.mail.show'));
});

it('S1: stores an SMTP host and password that the next mail of the instance uses', function () {
    Mail::fake();

    $this->put(route('admin.mail.update'), ['host' => 'smtp.stored.test', 'password' => 'stored-smtp-secret'])
        ->assertRedirect(route('admin.mail.show'))
        ->assertInertiaFlash('toast.type', 'success');

    $this->get(route('admin.mail.show'))
        ->assertInertia(fn (Assert $page) => $page->where('mail.fields.host.source', 'stored'));
    expect(config('mail.mailers.smtp.host'))->toBe('smtp.stored.test')
        ->and(config('mail.mailers.smtp.password'))->toBe('stored-smtp-secret');
    Mail::assertSent(InstanceConfigurationChangedMail::class);
});

it('says when there was nothing to save', function () {
    Mail::fake();

    $this->put(route('admin.mail.update'), [])
        ->assertRedirect(route('admin.mail.show'))
        ->assertInertiaFlash('toast.type', 'info');
});

it('links the alert of an SMTP change to the mail section', function () {
    $html = new InstanceConfigurationChangedMail($this->admin, InstanceSettingKey::Smtp, ['host'], [], '2026-10-03T14:02:00+00:00', null)->render();

    expect($html)->toContain(route('admin.mail.show'));
});

it('sends a test e-mail now and keeps the result', function () {
    Mail::fake();

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])
        ->assertRedirect(route('admin.mail.show'))
        ->assertSessionHas('inertia.flash_data.mailTest.ok', true);

    Mail::assertSent(InstanceTestMail::class, fn (InstanceTestMail $mail) => $mail->hasTo('camille@atlas.test'));
    expect(resolve(InstanceSettings::class)->mailLastTest())->toMatchArray(['ok' => true, 'to' => 'camille@atlas.test'])
        ->and(AuditEvent::query()->where('action', AuditAction::MailTested)->sole()->properties)->toBe(['ok' => true]);
});

it('shows the last test on the section', function () {
    Mail::fake();
    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test']);

    $this->get(route('admin.mail.show'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('lastTest.ok', true)
            ->where('lastTest.to', 'camille@atlas.test'));
});

it('renders the test e-mail with the instance name', function () {
    $html = new InstanceTestMail('Atlas Retro')->render();

    expect($html)->toContain('Atlas Retro');
});

it('turns a transport failure into a sentence', function () {
    Mail::shouldReceive('to->send')->andThrow(new TransportException('Connection refused by smtp.atlas.test'));

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])
        ->assertSessionHas('inertia.flash_data.mailTest.error', 'transport');

    expect(resolve(InstanceSettings::class)->mailLastTest()['ok'])->toBeFalse()
        ->and(json_encode(session()->all()))->not->toContain('Connection refused');
});

it('sends nothing and keeps a failed test while mails are written to the log', function () {
    config(['mail.default' => 'log']);
    Mail::fake();

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])
        ->assertSessionHas('inertia.flash_data.mailTest.error', 'log');

    Mail::assertNothingSent();
    expect(resolve(InstanceSettings::class)->mailLastTest())->toMatchArray(['ok' => false, 'error' => 'log']);
});

it('refuses a test to an address that is not one', function () {
    Mail::fake();

    $this->post(route('admin.mailTests.store'), ['to' => 'not an address'])->assertSessionHasErrors('to');

    Mail::assertNothingSent();
});

it('refuses the sixth test within ten minutes', function () {
    Mail::fake();

    foreach (range(1, 5) as $attempt) {
        $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test']);
    }

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])->assertTooManyRequests();
});

it('keeps the mail section to instance admins', function () {
    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->get(route('admin.mail.show'))->assertForbidden();
    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])->assertForbidden();
});
