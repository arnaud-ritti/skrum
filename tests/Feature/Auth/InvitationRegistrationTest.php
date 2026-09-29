<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);
});

function registrationPayload(string $email): array
{
    return [
        'name' => 'New Person',
        'email' => $email,
        'password' => 'password',
        'password_confirmation' => 'password',
    ];
}

it('makes the first user an instance admin', function () {
    User::query()->delete();

    $this->post(route('register.store'), registrationPayload('first@example.com'));

    expect(User::sole()->is_instance_admin)->toBeTrue();
});

it('does not make later users instance admins', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), registrationPayload('later@example.com'));

    expect(User::firstWhere('email', 'later@example.com')->is_instance_admin)->toBeFalse();
});

it('hides the registration page in invite mode', function () {
    $this->get(route('register'))->assertForbidden();
});

it('refuses registration in invite mode without an invitation', function () {
    $this->post(route('register.store'), registrationPayload('stranger@example.com'))
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('registers an invited person, verifies the email and joins the workspace', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create([
        'email' => 'Invited@Example.com',
        'role' => WorkspaceRole::Admin,
    ]);

    $this->get(route('invitations.show', 'secret-token'))->assertOk();
    $this->get(route('register'))
        ->assertInertia(fn (Assert $page) => $page->where('invitationEmail', 'Invited@Example.com'));

    $this->post(route('register.store'), registrationPayload('invited@example.com'));

    $user = User::firstWhere('email', 'invited@example.com');

    $this->assertAuthenticatedAs($user);
    expect($user->email_verified_at)->not->toBeNull()
        ->and($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Admin)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and(session('invitation_token'))->toBeNull();
});

it('refuses an invitation token used with another email', function () {
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'invited@example.com']);

    $this->get(route('invitations.show', 'secret-token'));

    $this->post(route('register.store'), registrationPayload('intruder@example.com'))
        ->assertSessionHasErrors('email');
});

it('shows expired invitations as expired and keeps registration closed', function () {
    WorkspaceInvitation::factory()->expired()->withToken('old-token')->create();

    $this->get(route('invitations.show', 'old-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('invitations/show')
            ->where('isExpired', true)
            ->where('canRegister', false));

    $this->get(route('register'))->assertForbidden();
});

it('returns not found for unknown invitation tokens', function () {
    $this->get(route('invitations.show', 'unknown'))->assertNotFound();
});

it('lets a logged in user with the invited email accept', function () {
    $user = User::factory()->create(['email' => 'member@example.com']);
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'MEMBER@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($user->roleIn($invitation->workspace))->toBe(WorkspaceRole::Member);
});

it('forbids accepting an invitation addressed to someone else', function () {
    $user = User::factory()->create(['email' => 'member@example.com']);
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'other@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertForbidden();
});

it('refuses to accept an expired invitation', function () {
    $user = User::factory()->create(['email' => 'member@example.com']);
    WorkspaceInvitation::factory()->expired()->withToken('secret-token')->create(['email' => 'member@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertStatus(410);
});

it('tells the login page whether registration is available', function (string $mode, bool $canRegister) {
    config(['skrum.signup_mode' => $mode]);

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page->where('canRegister', $canRegister));
})->with([
    ['invite', false],
    ['open', true],
]);
