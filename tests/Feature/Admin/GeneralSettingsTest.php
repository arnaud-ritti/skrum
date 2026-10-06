<?php

use App\Actions\Auth\SignupGate;
use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Foundation\Console\QueuedCommand;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create();
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('opens general from /admin with the environment values as defaults', function () {
    config(['skrum.signup_mode' => 'domain', 'skrum.allowed_email_domains' => ['acme.fr']]);

    $this->get('/admin')->assertRedirect(route('admin.general.edit'));
    $this->get(route('admin.general.edit'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('admin/general')
        ->where('signupMode', null)
        ->where('defaults.signupMode', 'domain')
        ->where('defaults.allowedEmailDomains', ['acme.fr'])
        ->where('updateCheckEnabled', false)
        ->where('image', 'ghcr.io/arnaud-ritti/skrum'));
});

it('stores the sign-up mode, which the sign-up gate then follows', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    $this->put(route('admin.general.update'), ['signup_mode' => 'open'])->assertRedirect(route('admin.general.edit'));
    auth()->logout();

    $this->get(route('register'))->assertOk();
});

it('returns to the environment sign-up mode once the stored one is cleared', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    $this->put(route('admin.general.update'), ['signup_mode' => 'open']);
    $this->put(route('admin.general.update'), ['signup_mode' => null]);
    auth()->logout();

    $this->get(route('register'))->assertForbidden();
});

it('lets in a stored allowed domain over the environment list', function () {
    config(['skrum.signup_mode' => 'invite', 'skrum.allowed_email_domains' => ['acme.fr']]);
    User::factory()->create();

    $this->put(route('admin.general.update'), ['signup_mode' => 'domain', 'allowed_email_domains' => ['Example.org']]);

    expect(resolve(InstanceSettings::class)->allowedEmailDomains())->toBe(['example.org'])
        ->and(resolve(SignupGate::class)->allows('mia@example.org'))->toBeTrue()
        ->and(resolve(SignupGate::class)->allows('mia@acme.fr'))->toBeFalse();
});

it('keeps the author of the maintenance message and audits the change', function () {
    $this->put(route('admin.general.update'), ['maintenance_message' => 'Back soon.']);

    expect(resolve(InstanceSettings::class)->maintenanceMessageBy())->toBe($this->admin->id)
        ->and(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->sole()->properties)
        ->toBeIgnoringKeyOrder(['section' => 'general', 'keys' => ['maintenance_message', 'maintenance_message_by']]);
});

it('keeps the author of an unchanged maintenance message saved by another admin', function () {
    $this->put(route('admin.general.update'), ['maintenance_message' => 'Back soon.']);
    $otherAdmin = User::factory()->instanceAdmin()->create();
    AuditEvent::query()->delete();

    $this->actingAs($otherAdmin)
        ->put(route('admin.general.update'), ['maintenance_message' => ' Back soon. ', 'signup_mode' => 'open'])
        ->assertRedirect(route('admin.general.edit'));

    expect(resolve(InstanceSettings::class)->maintenanceMessageBy())->toBe($this->admin->id)
        ->and(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->sole()->properties)
        ->toBeIgnoringKeyOrder(['section' => 'general', 'keys' => ['signup_mode']]);
});

it('clears the maintenance message and its author', function () {
    $this->put(route('admin.general.update'), ['maintenance_message' => 'Back soon.']);
    $this->put(route('admin.general.update'), ['maintenance_message' => '']);

    expect(resolve(InstanceSettings::class)->maintenanceMessage())->toBeNull()
        ->and(resolve(InstanceSettings::class)->maintenanceMessageBy())->toBeNull();
});

it('shows the author and the date of the saved maintenance message', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 9, 30, 0));
    $this->put(route('admin.general.update'), ['maintenance_message' => 'Back soon.']);

    $this->get(route('admin.general.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('maintenanceMessage', 'Back soon.')
        ->where('maintenanceMessageBy', ['name' => $this->admin->name])
        ->where('maintenanceMessageAt', '2026-10-03T09:30:00+00:00'));
});

it('records nothing when nothing changed', function () {
    $this->put(route('admin.general.update'), ['update_check_enabled' => false]);

    expect(AuditEvent::query()->count())->toBe(0);
});

it('runs the update check once when the switch is turned on', function () {
    Queue::fake();

    $this->put(route('admin.general.update'), ['update_check_enabled' => true]);

    Queue::assertPushed(QueuedCommand::class, fn (QueuedCommand $command): bool => $command->displayName() === 'skrum:check-for-update');
    Queue::assertCount(1);
});

it('refuses a domain that is not one', function () {
    $this->put(route('admin.general.update'), ['signup_mode' => 'domain', 'allowed_email_domains' => ['not a domain']])
        ->assertSessionHasErrors('allowed_email_domains.0');

    expect(resolve(InstanceSettings::class)->signupMode())->toBeNull();
    $this->assertDatabaseCount('instance_settings', 0);
});

it('requires at least one domain in domain mode', function () {
    config(['skrum.allowed_email_domains' => []]);

    $this->put(route('admin.general.update'), ['signup_mode' => 'domain', 'allowed_email_domains' => []])
        ->assertSessionHasErrors('allowed_email_domains');

    expect(resolve(InstanceSettings::class)->signupMode())->toBeNull();
    $this->assertDatabaseCount('instance_settings', 0);
});

it('requires a domain in domain mode when the form leaves the domains out and none is stored', function () {
    config(['skrum.allowed_email_domains' => []]);

    $this->put(route('admin.general.update'), ['signup_mode' => 'domain'])
        ->assertSessionHasErrors('allowed_email_domains');

    expect(resolve(InstanceSettings::class)->signupMode())->toBeNull();
});

it('accepts domain mode without domains in the form when some are stored', function () {
    config(['skrum.allowed_email_domains' => []]);
    resolve(InstanceSettings::class)->set('allowed_email_domains', ['acme.fr']);

    $this->put(route('admin.general.update'), ['signup_mode' => 'domain'])
        ->assertSessionHasNoErrors();
});

it('leaves the general settings in place on a branding reset', function () {
    $this->put(route('admin.general.update'), ['signup_mode' => 'open']);
    $this->delete(route('admin.branding.destroy'));

    expect(resolve(InstanceSettings::class)->signupMode())->toBe('open');
});
