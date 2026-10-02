<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    User::factory()->create();
    config([
        'skrum.signup_mode' => 'invite',
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
    ]);
});

function invitationFor(string $email = 'invited@example.com', string $token = 'secret-token'): WorkspaceInvitation
{
    return WorkspaceInvitation::factory()->withToken($token)->create([
        'email' => $email,
        'role' => WorkspaceRole::Admin,
    ]);
}

function accountPayload(array $overrides = []): array
{
    return ['name' => 'Ines Invited', 'password' => 'a-long-enough-password', ...$overrides];
}

it('creates the account of the invited address, verified, signed in and joined', function () {
    Event::fake([Registered::class]);
    $invitation = invitationFor('Invited@Example.com');

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload())
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    $user = User::firstWhere('email', 'invited@example.com');

    $this->assertAuthenticatedAs($user);
    Event::assertDispatched(Registered::class);
    expect($user->name)->toBe('Ines Invited')
        ->and(Hash::check('a-long-enough-password', $user->password))->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->is_instance_admin)->toBeFalse()
        ->and($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Admin)
        ->and($user->current_workspace_id)->toBe($invitation->workspace_id)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('never takes the address from the request', function () {
    $invitation = invitationFor();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload([
        'email' => 'intruder@example.com',
        'email_verified_at' => now()->toIso8601String(),
        'is_instance_admin' => true,
    ]))->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect(User::query()->where('email', 'intruder@example.com')->exists())->toBeFalse()
        ->and(auth()->user()->email)->toBe('invited@example.com')
        ->and(auth()->user()->is_instance_admin)->toBeFalse();
});

it('creates one account only for an invitation', function () {
    invitationFor();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload());
    auth()->logout();
    $this->flushSession();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload(['name' => 'Second Person']))
        ->assertStatus(410);

    $this->assertGuest();
    expect(User::query()->count())->toBe(2)
        ->and(User::query()->where('name', 'Second Person')->exists())->toBeFalse();
});

it('regenerates the session of the account it signs in, and forgets the followed invitation', function () {
    invitationFor();
    $this->get(route('invitations.show', 'secret-token'));
    $before = session()->getId();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload());

    $this->assertAuthenticated();
    expect(session()->getId())->not->toBe($before)
        ->and(session('invitation_token'))->toBeNull()
        ->and(session('url.intended'))->toBeNull();
});

it('creates no account for an expired, used or revoked invitation', function (string $state, int $status) {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'invited@example.com']);

    match ($state) {
        'expired' => $invitation->update(['expires_at' => now()->subMinute()]),
        'used' => $invitation->update(['accepted_at' => now()]),
        'revoked' => $invitation->delete(),
    };

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload())->assertStatus($status);

    $this->assertGuest();
    expect(User::query()->count())->toBe(1);
})->with([
    ['expired', 410],
    ['used', 410],
    ['revoked', 404],
]);

it('creates no account when one already owns the address, and leaves the invitation pending', function (string $invited) {
    $owner = User::factory()->create(['email' => 'invited@example.com', 'name' => 'Owner']);
    $invitation = invitationFor($invited);

    $this->from(route('invitations.show', 'secret-token'))
        ->post(route('invitations.account.store', 'secret-token'), accountPayload())
        ->assertRedirect(route('invitations.show', 'secret-token'))
        ->assertSessionHasErrors(['email' => __('validation.unique', ['attribute' => 'email'])]);

    $this->assertGuest();
    expect(User::query()->count())->toBe(2)
        ->and($owner->fresh()->name)->toBe('Owner')
        ->and(Hash::check('a-long-enough-password', $owner->fresh()->password))->toBeFalse()
        ->and($owner->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and($invitation->fresh()->isPending())->toBeTrue();
})->with(['invited@example.com', 'INVITED@Example.com']);

it('creates no account while single sign-on is required', function () {
    resolve(InstanceSettings::class)->set('sso_required', true);
    $invitation = invitationFor();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload())
        ->assertSessionHasErrors(['email' => __('This instance requires single sign-on.')]);

    $this->assertGuest();
    expect(User::query()->count())->toBe(1)
        ->and($invitation->fresh()->isPending())->toBeTrue();

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canRegister', false)
            ->where('passwordRules', null));
});

it('creates no account when registration is turned off', function () {
    config(['fortify.features' => []]);
    invitationFor();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload())->assertForbidden();

    $this->assertGuest();
    expect(User::query()->count())->toBe(1);

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->where('canRegister', false));
});

it('holds the name and the password to the rules of registration, without a confirmation', function (array $overrides, string $field) {
    $invitation = invitationFor();

    $this->post(route('invitations.account.store', 'secret-token'), accountPayload($overrides))
        ->assertSessionHasErrors($field);

    $this->assertGuest();
    expect(User::query()->count())->toBe(1)
        ->and($invitation->fresh()->isPending())->toBeTrue();
})->with([
    'no name' => [['name' => ''], 'name'],
    'a name too long' => [['name' => str_repeat('a', 256)], 'name'],
    'no password' => [['password' => ''], 'password'],
    'a password too short' => [['password' => 'short'], 'password'],
    'a password that is not a string' => [['password' => ['a-long-enough-password']], 'password'],
]);

it('limits the attempts of an address of origin', function () {
    invitationFor();

    foreach (range(1, 10) as $attempt) {
        $this->post(route('invitations.account.store', 'secret-token'), accountPayload(['password' => '']))
            ->assertSessionHasErrors('password');
    }

    $this->from(route('invitations.show', 'secret-token'))
        ->post(route('invitations.account.store', 'secret-token'), accountPayload())
        ->assertRedirect(route('invitations.show', 'secret-token'))
        ->assertSessionHasErrors(['email' => __('Too many attempts. Wait a minute and try again.')]);

    $this->assertGuest();
    expect(User::query()->count())->toBe(1);
});

it('is closed to a signed-in visitor', function () {
    $invitation = invitationFor();

    $this->actingAs(User::factory()->create())
        ->post(route('invitations.account.store', 'secret-token'), accountPayload())
        ->assertRedirect();

    expect(User::query()->where('email', 'invited@example.com')->exists())->toBeFalse()
        ->and($invitation->fresh()->isPending())->toBeTrue();
});

it('gives the password rule to a logged-out visitor who may create the account, and to nobody else', function () {
    invitationFor();

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canRegister', true)
            ->where('passwordRules', fn (string $rules) => str_contains($rules, 'minlength')));

    $this->actingAs(User::factory()->create())
        ->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->where('passwordRules', null));
});
