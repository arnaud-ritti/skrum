<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => 'github-id',
        'services.github.client_secret' => 'github-secret',
        'skrum.signup_mode' => 'invite',
    ]);
});

it('offers one entry per enabled provider to a logged out visitor of a pending invitation', function () {
    WorkspaceInvitation::factory()->withToken('secret-token')->create();

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('ssoProviders', 2)
            ->where('ssoProviders.0', ['key' => 'google', 'label' => 'Google'])
            ->where('ssoProviders.1', ['key' => 'github', 'label' => 'GitHub']));
});

it('offers no provider to a signed in visitor', function () {
    WorkspaceInvitation::factory()->withToken('secret-token')->create();

    $this->actingAs(User::factory()->create())
        ->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->where('ssoProviders', []));
});

it('offers no provider on an expired invitation', function () {
    WorkspaceInvitation::factory()->expired()->withToken('secret-token')->create();

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->missing('ssoProviders'));
});

it('sends none of the invitation props for an invalid token', function () {
    $this->get(route('invitations.show', 'unknown-token'))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->where('isInvalid', true)
            ->missing('ssoProviders')
            ->missing('inviter')
            ->missing('role')
            ->missing('expiresAt')
            ->missing('membersCount')
            ->missing('members'));
});

it('sends the inviter name and avatar', function () {
    $inviter = User::factory()->create(['name' => 'Ada Lovelace']);
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['invited_by_id' => $inviter->id]);

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inviter.name', 'Ada Lovelace')
            ->where('inviter.avatarUrl', $inviter->avatarUrl()));
});

it('sends a null inviter when the inviter account is gone', function () {
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['invited_by_id' => null]);

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->where('inviter', null));
});

it('sends the role, the expiry, the member count and the first five members by name', function () {
    $workspace = Workspace::factory()->create();
    $names = ['Frank', 'Bea', 'Eve', 'Adam', 'Dora', 'Cleo'];

    foreach ($names as $name) {
        $workspace->members()->attach(User::factory()->create(['name' => $name]), ['role' => WorkspaceRole::Member]);
    }

    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create([
        'workspace_id' => $workspace->id,
        'role' => WorkspaceRole::Admin,
    ]);

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('role', 'admin')
            ->where('expiresAt', $invitation->expires_at->toIso8601String())
            ->where('membersCount', 6)
            ->has('members', 5)
            ->where('members.0.name', 'Adam')
            ->where('members.4.name', 'Eve')
            ->has('members.0', fn (Assert $member) => $member->hasAll(['name', 'avatarUrl'])));
});

it('sends the workspace name, the inviter and the expiry of an expired invitation, and nothing else', function (string $state) {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $inviter = User::factory()->create(['name' => 'Ada Lovelace']);
    WorkspaceInvitation::factory()->{$state}()->withToken('secret-token')->create([
        'workspace_id' => $workspace->id,
        'invited_by_id' => $inviter->id,
    ]);

    $sharedProps = array_keys($this->get(route('invitations.show', 'unknown-token'))->inertiaProps());
    $response = $this->get(route('invitations.show', 'secret-token'))->assertOk();

    expect(array_values(array_diff(array_keys($response->inertiaProps()), $sharedProps)))
        ->toEqualCanonicalizing(['isExpired', 'workspaceName', 'inviter', 'expiresAt']);

    $response->assertInertia(fn (Assert $page) => $page
        ->where('isInvalid', false)
        ->where('isExpired', true)
        ->where('workspaceName', 'Nordlys')
        ->where('inviter', ['name' => 'Ada Lovelace', 'avatarUrl' => $inviter->avatarUrl()])
        ->has('expiresAt'));
})->with(['expired', 'accepted']);

it('sends the same expired props to a signed in visitor', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $invitation = WorkspaceInvitation::factory()->expired()->withToken('secret-token')->create([
        'workspace_id' => $workspace->id,
        'email' => 'invited@example.com',
    ]);

    $this->actingAs(User::factory()->create(['email' => 'invited@example.com']))
        ->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('workspaceName', 'Nordlys')
            ->where('expiresAt', $invitation->expires_at->toIso8601String())
            ->missing('token')
            ->missing('email')
            ->missing('emailMatches')
            ->missing('canRegister'));
});

it('carries no member, no e-mail and no token on an expired invitation', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $member = User::factory()->create(['name' => 'Hidden Member', 'email' => 'member-secret@example.com']);
    $inviter = User::factory()->create(['email' => 'inviter-secret@example.com']);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member]);
    WorkspaceInvitation::factory()->expired()->withToken('secret-token')->create([
        'workspace_id' => $workspace->id,
        'email' => 'invited@example.com',
        'invited_by_id' => $inviter->id,
    ]);

    $props = json_encode($this->get(route('invitations.show', 'secret-token'))->inertiaProps());

    expect($props)->toContain('Nordlys')
        ->not->toContain('Hidden Member')
        ->not->toContain('member-secret@example.com')
        ->not->toContain('inviter-secret@example.com')
        ->not->toContain('invited@example.com')
        ->not->toContain('secret-token')
        ->not->toContain($workspace->id);
});

it('never carries an e-mail other than the invited one', function () {
    $workspace = Workspace::factory()->create();
    $member = User::factory()->create(['email' => 'member-secret@example.com']);
    $inviter = User::factory()->create(['email' => 'inviter-secret@example.com']);
    $workspace->members()->attach($member, ['role' => WorkspaceRole::Member]);
    WorkspaceInvitation::factory()->withToken('secret-token')->create([
        'workspace_id' => $workspace->id,
        'email' => 'invited@example.com',
        'invited_by_id' => $inviter->id,
    ]);

    $content = $this->get(route('invitations.show', 'secret-token'))->getContent();

    expect($content)->toContain('invited@example.com')
        ->not->toContain('member-secret@example.com')
        ->not->toContain('inviter-secret@example.com');
});
