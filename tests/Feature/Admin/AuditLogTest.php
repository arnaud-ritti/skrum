<?php

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Artisan;
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
