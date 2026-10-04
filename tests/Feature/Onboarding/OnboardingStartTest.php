<?php

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => config(['skrum.signup_mode' => 'open']));

it('starts an onboarding holding the team name at registration, and creates nothing else', function () {
    User::factory()->create();

    $this->post(route('register.store'), [
        'name' => 'Sofia Laurent',
        'team_name' => '  Atlas ',
        'email' => 'sofia@example.com',
        'password' => 'a-long-enough-password-42',
        'password_confirmation' => 'a-long-enough-password-42',
    ])->assertRedirect();

    $user = User::query()->where('email', 'sofia@example.com')->sole();

    expect($user->onboarding->step)->toBe(OnboardingStep::Workspace)
        ->and($user->onboarding->team_name)->toBe('Atlas')
        ->and(Workspace::query()->count())->toBe(0);
});

it('asks for a team name only when the registration will start an onboarding', function () {
    $this->get(route('register'))->assertInertia(fn (Assert $page) => $page->where('asksTeamName', true));

    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));

    $this->get(route('register'))->assertInertia(fn (Assert $page) => $page->where('asksTeamName', false));
});

it('starts no onboarding for an account created through a link', function () {
    User::factory()->create();
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));

    $this->post(route('register.store'), [
        'name' => 'Nadia', 'email' => 'nadia@example.com',
        'password' => 'a-long-enough-password-42', 'password_confirmation' => 'a-long-enough-password-42',
    ]);

    expect(User::query()->where('email', 'nadia@example.com')->sole()->onboarding)->toBeNull();
});

it('sends a verified user without a workspace to the onboarding instead of the create page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));

    expect($user->fresh()->onboarding->step)->toBe(OnboardingStep::Workspace);
});

it('never sends an existing member of a workspace to the onboarding', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)->get(route('dashboard'))->assertRedirect(route('teams.show', [$team->workspace, $team]));

    expect($member->fresh()->onboarding)->toBeNull();
});

it('resumes an onboarding that is not completed', function () {
    $onboarding = Onboarding::factory()->atStep(OnboardingStep::Invite)->create();
    Workspace::factory()->withMember($onboarding->user)->create();

    $this->actingAs($onboarding->user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));
});

it('reopens a completed onboarding for a user who left every workspace', function () {
    $onboarding = Onboarding::factory()->atStep(OnboardingStep::Ritual)->completed()->create();

    $this->actingAs($onboarding->user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));

    $onboarding->refresh();

    expect($onboarding->isCompleted())->toBeFalse()
        ->and($onboarding->step)->toBe(OnboardingStep::Workspace)
        ->and($onboarding->workspace_id)->toBeNull()
        ->and($onboarding->team_id)->toBeNull();

    $this->actingAs($onboarding->user)->get(route('onboarding.show'))->assertOk();
});

it('sends a user who opened a link before registering back to the link', function () {
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->create())
        ->withSession(['invite_link_token' => 'join-token-0123456789abcdefghijklmnopqrst'])
        ->get(route('dashboard'))
        ->assertRedirect(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));
});

it('closes an onboarding without a workspace when its user joins by an invitation or a link', function (string $how) {
    $onboarding = Onboarding::factory()->create();
    $user = $onboarding->user;
    $team = Team::factory()->create();

    if ($how === 'invitation') {
        WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['email' => $user->email]);
        $this->actingAs($user)->post(route('invitations.acceptance.store', 't'));
    }

    if ($how === 'link') {
        TeamInviteLink::factory()->for($team)->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
        $this->actingAs($user)->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'));
    }

    expect($onboarding->fresh()->isCompleted())->toBeTrue();
})->with(['invitation', 'link']);

it('follows a link visitor through registration and verification back to the link', function () {
    User::factory()->create();
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));

    $this->post(route('register.store'), [
        'name' => 'Nadia', 'email' => 'nadia@example.com',
        'password' => 'a-long-enough-password-42', 'password_confirmation' => 'a-long-enough-password-42',
    ])->assertRedirect(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));
});

it('opens the onboarding page only for an onboarding that is not completed', function () {
    $completed = Onboarding::factory()->completed()->create();
    Workspace::factory()->withMember($completed->user)->create();

    $this->actingAs($completed->user)->get(route('onboarding.show'))->assertRedirect(route('dashboard'));
    $this->actingAs(User::factory()->create())->get(route('onboarding.show'))->assertRedirect(route('dashboard'));
});
