<?php

use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the board to team members and creates their participant', function () {
    $retro = Retro::factory()->create();
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $this->actingAs($user)
        ->get(route('retros.show', $retro))
        ->assertInertia(fn (Assert $page) => $page
            ->component('retros/show')
            ->where('snapshot.retro.id', $retro->id)
            ->where('snapshot.viewer.isGuest', false));

    expect($retro->participants()->where('user_id', $user->id)->count())->toBe(1);

    $this->actingAs($user)->get(route('retros.show', $retro));

    expect($retro->participants()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets workspace managers open any team retro', function () {
    $retro = Retro::factory()->create();
    $admin = User::factory()->create();
    $retro->team->workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);

    $this->actingAs($admin)->get(route('retros.show', $retro))->assertOk();
});

it('forbids members of the workspace outside the team', function () {
    $retro = Retro::factory()->create();
    $member = User::factory()->create();
    $retro->team->workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($member)->get(route('retros.show', $retro))->assertForbidden();
    $this->actingAs($member)->getJson(route('retros.snapshot.show', $retro))->assertForbidden();
});

it('sends logged out visitors to the login page', function () {
    $this->get(route('retros.show', Retro::factory()->create()))->assertRedirect(route('login'));
});

it('answers json requests from strangers with 403', function () {
    $this->getJson(route('retros.snapshot.show', Retro::factory()->create()))->assertForbidden();
});

it('recognises a guest by cookie while guest access is enabled', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest('s3cret')->create(['retro_id' => $retro->id]);

    $this->withCredentials()
        ->withCookies(retroGuestCookie($guest, 's3cret'))
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('viewer.participantId', $guest->id)
        ->assertJsonPath('viewer.isGuest', true);
});

it('rejects guests once guest access is disabled', function () {
    $retro = Retro::factory()->create();
    $guest = Participant::factory()->guest('s3cret')->create(['retro_id' => $retro->id]);

    $this->withCredentials()
        ->withCookies(retroGuestCookie($guest, 's3cret'))
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertForbidden();
});

it('rejects forged or foreign guest cookies', function (Closure $cookie) {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest('s3cret')->create(['retro_id' => $retro->id]);
    $otherRetroGuest = Participant::factory()->guest('s3cret')->create();

    $this->withCredentials()
        ->withCookies($cookie($retro, $guest, $otherRetroGuest))
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertForbidden();
})->with([
    'wrong secret' => fn ($retro, $guest) => retroGuestCookie($guest, 'nope'),
    'garbage' => fn ($retro) => ['retro_guest_'.$retro->id => 'not-a-uuid|x'],
    'other retro participant' => fn ($retro, $guest, $other) => ['retro_guest_'.$retro->id => $other->id.'|s3cret'],
]);

it('keeps guests out of workspace pages', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->get(route('workspaces.show', $retro->team->workspace))
        ->assertRedirect(route('login'));
});

it('returns 404 for unknown retros', function () {
    $this->actingAs(User::factory()->create())
        ->get('/retros/'.fake()->uuid())
        ->assertNotFound();
});

it('returns 404 for malformed retro ids', function () {
    $this->actingAs(User::factory()->create())
        ->get('/retros/not-a-uuid')
        ->assertNotFound();
});

it('does not let one workspace reach another workspace retro', function () {
    $retro = Retro::factory()->create();
    $owner = User::factory()->create();
    Workspace::factory()->withMember($owner, WorkspaceRole::Owner)->create();

    $this->actingAs($owner)->get(route('retros.show', $retro))->assertForbidden();
});
