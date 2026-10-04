<?php

use App\Enums\ColumnColor;
use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\TeamInviteLink;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

it('creates the workspace at step one, then renames it after Back', function () {
    $onboarding = Onboarding::factory()->create();
    $user = $onboarding->user;

    $this->actingAs($user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'fr'])->assertRedirect(route('onboarding.show'));
    $workspace = Workspace::query()->sole();

    expect($user->roleIn($workspace))->toBe(WorkspaceRole::Owner)
        ->and($workspace->locale)->toBe('fr')
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Team);

    $this->actingAs($user)->put(route('onboarding.step.update'), ['step' => 'workspace'])->assertRedirect();
    $this->actingAs($user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys SA', 'locale' => 'en']);

    expect(Workspace::query()->sole()->name)->toBe('Nordlys SA');
});

it('creates the team at step two with its colour, the user its owner, prefilled from registration', function () {
    $onboarding = Onboarding::factory()->create(['team_name' => 'Atlas']);
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);

    $this->actingAs($onboarding->user)
        ->get(route('onboarding.show'))
        ->assertInertia(fn (Assert $page) => $page->component('onboarding/show')->where('step', 'team')->where('teamName', 'Atlas'));

    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas', 'color' => 'lagoon'])->assertRedirect();
    $team = $onboarding->fresh()->team;

    expect($team->color)->toBe(ColumnColor::Lagoon)
        ->and($team->workspace_id)->toBe($onboarding->fresh()->workspace_id)
        ->and($team->roleOf($onboarding->user))->toBe(TeamRole::Owner)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Invite);

    $this->actingAs($onboarding->user)->put(route('onboarding.step.update'), ['step' => 'workspace']);
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);
    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas 2', 'color' => 'moss']);

    expect($team->workspace->teams()->count())->toBe(1)
        ->and($team->fresh()->name)->toBe('Atlas 2');
});

it('refuses the team step before the workspace exists', function () {
    $onboarding = Onboarding::factory()->create();

    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas'])->assertSessionHasErrors('name');
});

it('sends the invitations of step three, or skips them', function () {
    Notification::fake();
    $onboarding = onboardingAtInvite();

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.invitations.store'), ['emails' => ['camille@example.com', 'theo@example.com'], 'role' => 'member'])
        ->assertRedirect(route('onboarding.show'));

    expect($onboarding->fresh()->team->invitations()->count())->toBe(2)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Ritual);

    $other = onboardingAtInvite();
    $this->actingAs($other->user)->put(route('onboarding.step.update'), ['step' => 'ritual'])->assertRedirect();
    expect($other->fresh()->step)->toBe(OnboardingStep::Ritual);
});

it('shows the team, its link and its pending invitations at step three', function () {
    $onboarding = onboardingAtInvite();
    $team = $onboarding->team;
    $link = TeamInviteLink::factory()->for($team)->joinedBy(2)->create();
    WorkspaceInvitation::factory()->forTeam($team)->create();

    $this->actingAs($onboarding->user)
        ->get(route('onboarding.show'))
        ->assertInertia(fn (Assert $page) => $page->component('onboarding/show')
            ->where('step', 'invite')
            ->where('team.id', $team->id)
            ->where('workspace.name', $team->workspace->name)
            ->where('workspace.slug', $team->workspace->slug)
            ->where('inviteLinkUrl', $link->url())
            ->where('inviteLinkExpiresInDays', TeamInviteLink::ValidForDays)
            ->where('inviteLinkUsesCount', 2)
            ->where('invitedCount', 1)
            ->where('membersCount', 1)
            ->where('inviteRoles', ['facilitator', 'member', 'observer']));
});

it('refuses a move the stepper does not offer', function (OnboardingStep $from, string $to) {
    $onboarding = Onboarding::factory()->atStep($from)->create();

    $this->actingAs($onboarding->user)->put(route('onboarding.step.update'), ['step' => $to])->assertSessionHasErrors('step');
})->with([
    [OnboardingStep::Workspace, 'ritual'],
    [OnboardingStep::Team, 'invite'],
    [OnboardingStep::Ritual, 'workspace'],
]);

it('completes at step four and opens the new session dialog on the chosen type', function (?string $ritual, string $query) {
    $onboarding = onboardingAtInvite();
    $onboarding->update(['step' => OnboardingStep::Ritual]);
    $team = $onboarding->team;

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.completion.store'), array_filter(['ritual' => $ritual]))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]).$query);

    expect($onboarding->fresh()->isCompleted())->toBeTrue();
    $this->actingAs($onboarding->user)->get(route('onboarding.show'))->assertRedirect(route('dashboard'));
})->with([
    ['retro', '?new=retro'],
    ['icebreaker', '?new=icebreaker'],
    [null, ''],
]);

it('lets nobody else touch the onboarding of a user', function () {
    $onboarding = onboardingAtInvite();
    $stranger = Onboarding::factory()->create()->user;

    $this->actingAs($stranger)->put(route('onboarding.team.update'), ['name' => 'Hijack'])->assertSessionHasErrors('name');
    expect($onboarding->fresh()->team->name)->not->toBe('Hijack');
});

it('takes an onboarding back to the team step when its team was deleted, so its user can go on', function () {
    $onboarding = onboardingAtInvite();
    $onboarding->update(['step' => OnboardingStep::Ritual]);
    $onboarding->team->delete();

    $this->actingAs($onboarding->user)
        ->get(route('onboarding.show'))
        ->assertInertia(fn (Assert $page) => $page->where('step', 'team'));

    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas', 'color' => 'lagoon'])->assertSessionHasNoErrors();

    expect($onboarding->fresh()->step)->toBe(OnboardingStep::Invite);
});

it('takes an onboarding back to the workspace step when its workspace was deleted', function () {
    $onboarding = onboardingAtInvite();
    $onboarding->workspace->delete();

    $this->actingAs($onboarding->user)
        ->get(route('onboarding.show'))
        ->assertInertia(fn (Assert $page) => $page->where('step', 'workspace'));

    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en'])->assertSessionHasNoErrors();

    expect($onboarding->fresh()->step)->toBe(OnboardingStep::Team);
});
