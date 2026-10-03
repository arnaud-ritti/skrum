<?php

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Artisan;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;

function confirmedAdmin(mixed $test): User
{
    $admin = User::factory()->instanceAdmin()->create();
    $test->actingAs($admin)->withSession(['auth.password_confirmed_at' => time()]);

    return $admin;
}

function auditBrandingPayload(string $displayName): array
{
    return [
        'brand_color' => null,
        'brand_radius' => null,
        'display_name' => $displayName,
        'powered_by' => null,
        'avatar_style' => null,
        'avatar_member_choice' => null,
        'gif_provider' => null,
        'gif_enabled' => null,
        'gif_rating' => null,
    ];
}

it('records a branding change with the changed keys and no value', function () {
    $admin = confirmedAdmin($this);

    $this->put(route('admin.branding.update'), auditBrandingPayload('Atlas Rétros'))->assertSessionHasNoErrors();

    $event = AuditEvent::query()->sole();
    expect($event->action)->toBe(AuditAction::SettingsUpdated)
        ->and($event->actor_user_id)->toBe($admin->id)
        ->and($event->actor_name)->toBe($admin->name)
        ->and($event->properties)->toBeIgnoringKeyOrder(['section' => 'branding', 'keys' => ['display_name']]);
});

it('records nothing when a branding save changes no value', function () {
    confirmedAdmin($this);

    $this->put(route('admin.branding.update'), auditBrandingPayload('Atlas Rétros'))->assertRedirect();
    $this->put(route('admin.branding.update'), auditBrandingPayload('Atlas Rétros'))->assertRedirect();

    expect(AuditEvent::query()->count())->toBe(1);
});

it('records a branding reset', function () {
    confirmedAdmin($this);

    $this->delete(route('admin.branding.destroy'))->assertRedirect();

    expect(AuditEvent::query()->sole()->action)->toBe(AuditAction::BrandingReset);
});

it('records a granted and a revoked admin with the user as subject', function () {
    confirmedAdmin($this);
    $other = User::factory()->create();

    $this->post(route('admin.admins.store'), ['user_id' => $other->id]);
    $this->delete(route('admin.admins.destroy', $other));

    expect(AuditEvent::query()->orderBy('created_at')->orderBy('id')->pluck('action')->all())
        ->toBe([AuditAction::AdminGranted, AuditAction::AdminRevoked])
        ->and(AuditEvent::query()->pluck('subject_id')->unique()->all())->toBe([$other->id]);
});

it('records no revoke when the last admin is kept', function () {
    $admin = confirmedAdmin($this);

    $this->delete(route('admin.admins.destroy', $admin))->assertSessionHasErrors('user');

    expect(AuditEvent::query()->exists())->toBeFalse();
});

it('records a change of the single sign-on requirement only when it changes', function () {
    confirmedAdmin($this);

    $this->put(route('admin.signIn.update'), ['sso_required' => false])->assertRedirect();

    expect(AuditEvent::query()->exists())->toBeFalse();
});

it('records a sign-in and a failed sign-in without the password', function () {
    $user = User::factory()->create();

    event(new Login('web', $user, false));
    event(new Failed('web', null, ['email' => 'Nadia@Example.org', 'password' => 'secret-password']));

    $failed = AuditEvent::query()->where('action', AuditAction::SignInFailed)->sole();
    expect(AuditEvent::query()->where('action', AuditAction::SignedIn)->sole()->actor_user_id)->toBe($user->id)
        ->and($failed->properties)->toBeIgnoringKeyOrder(['email' => 'nadia@example.org'])
        ->and(json_encode($failed->properties))->not->toContain('secret-password');
});

it('records the second factors turned on and off', function () {
    $user = User::factory()->create();

    event(new TwoFactorAuthenticationConfirmed($user));
    event(new TwoFactorAuthenticationDisabled($user));

    expect(AuditEvent::query()->orderBy('created_at')->orderBy('id')->pluck('action')->all())
        ->toBe([AuditAction::TwoFactorEnabled, AuditAction::TwoFactorDisabled]);
});

it('records the e-mail second factor turned off with its method', function () {
    $user = User::factory()->create(['two_factor_email_enabled_at' => now()]);
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()]);

    $this->delete(route('emailSecondFactor.destroy'))->assertRedirect();

    $event = AuditEvent::query()->sole();
    expect($event->action)->toBe(AuditAction::TwoFactorDisabled)
        ->and($event->properties)->toBeIgnoringKeyOrder(['method' => 'email']);
});

it('records a password changed in the settings without the password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->put(route('user-password.update'), [
        'current_password' => 'password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])->assertSessionHasNoErrors();

    $event = AuditEvent::query()->sole();
    expect($event->action)->toBe(AuditAction::PasswordChanged)
        ->and($event->actor_user_id)->toBe($user->id)
        ->and(json_encode($event->properties))->not->toContain('new-password');
});

it('records a token created and revoked by its owner', function () {
    config(['skrum.mcp.enabled' => true]);
    $user = User::factory()->create();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()]);

    $this->post(route('apiTokens.store'), ['name' => 'Claude', 'expiration' => '30_days'])->assertRedirect();
    $token = $user->tokens()->sole();
    $this->delete(route('apiTokens.destroy', $token->id))->assertRedirect();

    expect(AuditEvent::query()->orderBy('created_at')->orderBy('id')->pluck('action')->all())
        ->toBe([AuditAction::TokenCreated, AuditAction::TokenRevoked]);
});

it('prunes events older than the retention', function () {
    AuditEvent::factory()->create(['created_at' => now()->subDays(AuditEvent::Retention + 1)]);
    $kept = AuditEvent::factory()->create(['created_at' => now()->subDays(AuditEvent::Retention - 1)]);

    Artisan::call('model:prune', ['--model' => [AuditEvent::class]]);

    expect(AuditEvent::query()->pluck('id')->all())->toBe([$kept->id]);
});

it('lists audit events newest first, 50 a page, filtered by group', function () {
    $admin = confirmedAdmin($this);
    AuditEvent::factory()->create(['action' => AuditAction::SignedIn, 'created_at' => now()->subMinute()]);
    AuditEvent::factory()->create(['action' => AuditAction::AdminGranted, 'created_at' => now()]);

    $this->get(route('admin.auditEvents.index'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/audit-log')->where('events.data.0.action', 'admin_granted')->where('retentionDays', 365));
    $this->get(route('admin.auditEvents.index', ['group' => 'signIn']))
        ->assertInertia(fn (Assert $page) => $page->has('events.data', 1)->where('events.data.0.action', 'signed_in'));
});

it('pages the audit events by 50', function () {
    confirmedAdmin($this);
    AuditEvent::factory()->count(51)->create(['actor_user_id' => null, 'actor_name' => '']);

    $this->get(route('admin.auditEvents.index'))->assertInertia(fn (Assert $page) => $page
        ->has('events.data', 50)
        ->where('events.total', 51));
});

it('filters the audit events by actor', function () {
    confirmedAdmin($this);
    $nadia = User::factory()->create(['name' => 'Nadia']);
    AuditEvent::factory()->create(['actor_user_id' => $nadia->id, 'actor_name' => 'Nadia', 'action' => AuditAction::PasswordChanged]);
    AuditEvent::factory()->create();

    $this->get(route('admin.auditEvents.index', ['actor' => $nadia->id]))->assertInertia(fn (Assert $page) => $page
        ->has('events.data', 1)
        ->where('events.data.0.actor.name', 'Nadia')
        ->where('events.data.0.group', 'signIn')
        ->where('filters', ['group' => null, 'actor' => $nadia->id]));
});

it('names the user subject of an event and shows the system for an event without actor', function () {
    confirmedAdmin($this);
    $malik = User::factory()->create(['name' => 'Malik']);
    AuditEvent::factory()->create([
        'actor_user_id' => null,
        'actor_name' => '',
        'action' => AuditAction::UserDeactivated,
        'subject_type' => 'User',
        'subject_id' => $malik->id,
    ]);

    $this->get(route('admin.auditEvents.index'))->assertInertia(fn (Assert $page) => $page
        ->where('events.data.0.actor', null)
        ->where('events.data.0.subject', ['type' => 'User', 'id' => $malik->id, 'label' => 'Malik']));
});

it('keeps the name of an actor whose account is gone', function () {
    confirmedAdmin($this);
    AuditEvent::factory()->create(['actor_user_id' => null, 'actor_name' => 'Ines']);

    $this->get(route('admin.auditEvents.index'))->assertInertia(fn (Assert $page) => $page
        ->where('events.data.0.actor', ['name' => 'Ines', 'avatarUrl' => null]));
});

it('refuses an unknown group filter', function () {
    confirmedAdmin($this);

    $this->get(route('admin.auditEvents.index', ['group' => 'everything']))->assertSessionHasErrors('group');
});

it('refuses the audit log to a member who is not an instance admin', function () {
    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->get(route('admin.auditEvents.index'))->assertForbidden();
});
