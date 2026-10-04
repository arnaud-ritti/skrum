<?php

use App\Actions\Auth\ResolveSsoUser;
use App\Actions\Auth\SignupGate;
use App\Enums\SsoProvider;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\TeamInviteLink;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Two\User as SocialiteUser;

it('adds a verified account to the workspace and the team and counts the use', function () {
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertRedirect(route('teams.show', [$link->team->workspace, $link->team]));

    expect($user->roleIn($link->team->workspace))->toBe(WorkspaceRole::Member)
        ->and($link->team->roleOf($user))->toBe(TeamRole::Member)
        ->and($link->fresh()->uses_count)->toBe(1)
        ->and($user->fresh()->current_workspace_id)->toBe($link->team->workspace_id);
});

it('counts nothing for someone already in the team', function () {
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $member = teamMember($link->team);

    $this->actingAs($member)->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))->assertRedirect();

    expect($link->fresh()->uses_count)->toBe(0);
});

it('refuses a link that expired or was turned off', function (string $state) {
    TeamInviteLink::factory()->{$state}()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->create())
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertStatus(410);
})->with(['expired', 'revoked']);

it('keeps letting people join however many joined before (no use limit)', function () {
    $link = TeamInviteLink::factory()->joinedBy(500)->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->create())
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertRedirect(route('teams.show', [$link->team->workspace, $link->team]));

    expect($link->fresh()->uses_count)->toBe(501);
});

it('asks an unverified account to verify its address before joining', function () {
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->unverified()->create())
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertRedirect(route('verification.notice'));
});

it('shows a signed-out visitor the team and remembers the link for registration', function () {
    config(['skrum.signup_mode' => 'invite']);
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertSessionHas('invite_link_token', 'join-token-0123456789abcdefghijklmnopqrst')
        ->assertInertia(fn (Assert $page) => $page
            ->component('invite-links/show')
            ->where('isUsable', true)
            ->where('teamName', $link->team->name)
            ->where('canRegister', true)
            ->where('isLoggedIn', false));

    $this->get(route('register'))->assertOk();
});

it('opens registration through a link by signup mode', function (string $mode, string $email, bool $allowed) {
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => ['nordlys.io']]);
    User::factory()->create();
    $link = TeamInviteLink::factory()->create();

    expect(resolve(SignupGate::class)->allows($email, null, $link))->toBe($allowed);
})->with([
    'invite mode' => ['invite', 'anyone@example.com', true],
    'domain mode, listed domain' => ['domain', 'nadia@nordlys.io', true],
    'domain mode, other domain' => ['domain', 'anyone@example.com', false],
    'open mode' => ['open', 'anyone@example.com', true],
]);

it('shows the link page of an expired link as no longer working, naming its creator', function () {
    $creator = User::factory()->create();
    TeamInviteLink::factory()->expired()->for($creator, 'createdBy')->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertInertia(fn (Assert $page) => $page->where('isUsable', false)->where('inviter.name', $creator->name));
});

it('answers 404 with the invalid card for an unknown token', function () {
    $this->get(route('inviteLinks.show', 'nope'))->assertNotFound();
});

it('registers a visitor who came by a usable link in invite mode, without joining the team yet', function (bool $isTurnedOff, bool $registered) {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();
    $link = TeamInviteLink::factory()->state(['revoked_at' => $isTurnedOff ? now() : null])->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->withSession(['invite_link_token' => 'join-token-0123456789abcdefghijklmnopqrst'])
        ->post(route('register.store'), [
            'name' => 'Nadia',
            'email' => 'nadia@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

    $user = User::query()->firstWhere('email', 'nadia@example.com');

    expect($user !== null)->toBe($registered)
        ->and($link->team->members()->count())->toBe(0)
        ->and($link->fresh()->uses_count)->toBe(0);
})->with([
    'usable link' => [false, true],
    'turned-off link' => [true, false],
]);

it('creates an SSO account in invite mode for a visitor who came by a usable link', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();
    $link = TeamInviteLink::factory()->create();

    $user = resolve(ResolveSsoUser::class)->handle(
        SsoProvider::Google,
        SocialiteUser::fake(['id' => 'g-link', 'email' => 'nadia@example.com', 'email_verified' => true]),
        null,
        $link,
    );

    expect($user->email)->toBe('nadia@example.com');
});
