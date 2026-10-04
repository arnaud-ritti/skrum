<?php

use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['skrum.signup_mode' => 'open']);
    User::factory()->create();
    $this->defaultWorkspace = Workspace::factory()->create(['name' => 'Nordlys']);
    resolve(InstanceSettings::class)->set('default_workspace', $this->defaultWorkspace->id);
});

it('lets a new SSO account join the default workspace as a member and start at the team step', function () {
    $user = newSsoAccount('nadia@nordlys.io');

    expect($user->roleIn($this->defaultWorkspace))->toBe(WorkspaceRole::Member)
        ->and($user->current_workspace_id)->toBe($this->defaultWorkspace->id)
        ->and($user->onboarding->step)->toBe(OnboardingStep::Team)
        ->and($user->onboarding->workspace_id)->toBe($this->defaultWorkspace->id);

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));
    $this->actingAs($user)->get(route('onboarding.show'))->assertInertia(fn (Assert $page) => $page
        ->component('onboarding/show')
        ->where('step', 'team')
        ->where('canEditWorkspace', false)
        ->where('workspace.name', 'Nordlys'));
});

it('lets the joiner create one team at step two, but never go back to the admin workspace', function () {
    $user = newSsoAccount('nadia@nordlys.io');

    $this->actingAs($user)->put(route('onboarding.step.update'), ['step' => 'workspace'])->assertSessionHasErrors('step');
    $this->actingAs($user)->put(route('onboarding.workspace.update'), ['name' => 'Renamed', 'locale' => 'en'])->assertForbidden();
    $this->actingAs($user)->put(route('onboarding.team.update'), ['name' => 'Atlas', 'color' => 'lagoon'])->assertRedirect(route('onboarding.show'));

    expect($this->defaultWorkspace->fresh()->name)->toBe('Nordlys')
        ->and($this->defaultWorkspace->teams()->sole()->roleOf($user))->toBe(TeamRole::Owner)
        ->and($user->fresh()->onboarding->step)->toBe(OnboardingStep::Invite);
});

it('keeps the team creation of a workspace member outside the onboarding refused (Rule D-1)', function () {
    $user = newSsoAccount('nadia@nordlys.io');
    $user->onboarding->update(['completed_at' => now()]);

    $this->actingAs($user)->post(route('teams.store', $this->defaultWorkspace), ['name' => 'Borealis'])->assertForbidden();
});

it('lets the joiner skip step two and land in the default workspace', function () {
    $user = newSsoAccount('nadia@nordlys.io');

    $this->actingAs($user)->post(route('onboarding.completion.store'))->assertRedirect(route('dashboard'));

    expect($user->fresh()->onboarding->isCompleted())->toBeTrue()
        ->and($this->defaultWorkspace->teams()->count())->toBe(0);
});

it('ends the joiner\'s onboarding when they then join a team by an invitation or a link', function (string $how) {
    $user = newSsoAccount('nadia@nordlys.io');
    $team = Team::factory()->create();

    if ($how === 'invitation') {
        WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['email' => $user->email]);
        $this->actingAs($user)->post(route('invitations.acceptance.store', 't'));
    }

    if ($how === 'link') {
        TeamInviteLink::factory()->for($team)->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
        $this->actingAs($user)->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'));
    }

    expect($user->fresh()->onboarding->isCompleted())->toBeTrue()
        ->and($this->actingAs($user->fresh())->get(route('dashboard'))->headers->get('Location'))->not->toBe(route('onboarding.show'));
})->with(['invitation', 'link']);

it('keeps the onboarding of a workspace owner who joins another team', function () {
    $user = newSsoAccount('nadia@nordlys.io');
    $this->defaultWorkspace->members()->updateExistingPivot($user->id, ['role' => WorkspaceRole::Owner->value]);
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs($user)->post(route('inviteLinks.membership.store', $link->token));

    expect($user->fresh()->onboarding->isCompleted())->toBeFalse();
});

it('joins only the invitation workspace when an invitation brought the account', function () {
    $team = Team::factory()->create();
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'nadia@nordlys.io']);

    $user = newSsoAccount('nadia@nordlys.io', $invitation);

    expect($user->belongsToWorkspace($this->defaultWorkspace))->toBeFalse()
        ->and($user->belongsToWorkspace($team->workspace))->toBeTrue()
        ->and($user->onboarding)->toBeNull();
});

it('leaves the account to its link when a usable link brought it', function () {
    $link = TeamInviteLink::factory()->create();

    $user = newSsoAccount('nadia@nordlys.io', null, $link);

    expect($user->belongsToWorkspace($this->defaultWorkspace))->toBeFalse()
        ->and($user->onboarding)->toBeNull();
});

it('applies to new SSO accounts only', function () {
    $existing = User::factory()->create(['email' => 'camille@nordlys.io']);
    newSsoAccount('camille@nordlys.io');

    $this->post(route('register.store'), [
        'name' => 'Théo', 'email' => 'theo@nordlys.io',
        'password' => 'a-long-enough-password-42', 'password_confirmation' => 'a-long-enough-password-42',
    ]);
    $registered = User::query()->where('email', 'theo@nordlys.io')->sole();

    expect($existing->fresh()->belongsToWorkspace($this->defaultWorkspace))->toBeFalse()
        ->and($registered->belongsToWorkspace($this->defaultWorkspace))->toBeFalse()
        ->and($registered->onboarding->step)->toBe(OnboardingStep::Workspace);
});

it('does nothing when the default workspace is unset or deleted', function () {
    resolve(InstanceSettings::class)->set('default_workspace', null);
    $first = newSsoAccount('a@nordlys.io');

    resolve(InstanceSettings::class)->set('default_workspace', $this->defaultWorkspace->id);
    $this->defaultWorkspace->delete();
    $second = newSsoAccount('b@nordlys.io');

    expect($first->workspaces()->count())->toBe(0)
        ->and($second->workspaces()->count())->toBe(0)
        ->and($first->onboarding)->toBeNull()
        ->and($second->onboarding)->toBeNull();
});

it('shows step one again when the default workspace is deleted during the onboarding', function () {
    $user = newSsoAccount('nadia@nordlys.io');
    $this->defaultWorkspace->delete();

    $this->actingAs($user)->get(route('onboarding.show'))->assertInertia(fn (Assert $page) => $page
        ->where('step', 'workspace')
        ->where('canEditWorkspace', true));
});
