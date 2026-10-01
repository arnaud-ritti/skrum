<?php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

it('lets team members in as themselves', function () {
    $board = Whiteboard::factory()->create();
    $user = teamMember($board->team);

    $this->actingAs($user)
        ->get(route('whiteboards.show', $board))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('whiteboards/show')
            ->where('snapshot.board.id', $board->id)
            ->where('snapshot.me.isGuest', false));

    $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->assertOk();

    expect($board->members()->where('user_id', $user->id)->count())->toBe(1);
});

it('lets workspace managers open any team board', function () {
    $board = Whiteboard::factory()->create();

    $this->actingAs(workspaceManager($board->team->workspace))
        ->get(route('whiteboards.show', $board))
        ->assertOk();
});

it('lets a guest with a valid cookie in while guest access is on', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('me.id', $guest->id)
        ->assertJsonPath('me.isGuest', true);
});

it('refuses guests once guest access is off or the secret is wrong', function () {
    $board = Whiteboard::factory()->create();
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();

    $board->update(['guest_access_enabled' => true]);

    $this->withCookies(whiteboardGuestCookie($guest, 'wrong'))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();
});

it('never treats a cookie for a user-linked member as a guest', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [, $member] = whiteboardMember($board);
    $member->update(['guest_secret_hash' => hash('sha256', 'secret')]);

    $this->withCookies(whiteboardGuestCookie($member))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();
});

it('sends logged-out visitors to login', function () {
    $this->get(route('whiteboards.show', Whiteboard::factory()->create()))->assertRedirect(route('login'));
});

it('shows the session-ended page for guest-enabled boards', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();

    $this->get(route('whiteboards.show', $board))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('retros/session-ended'))
        ->assertSessionHas('url.intended', route('whiteboards.show', $board));
});

it('refuses non-members with 403', function () {
    $board = Whiteboard::factory()->create();
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get(route('whiteboards.show', $board))->assertForbidden();
    $this->actingAs($outsider)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden()
        ->assertJsonPath('message', 'You no longer have access to this board.');

    expect($board->members()->count())->toBe(0);
});

it('answers logged-out json requests with 401', function () {
    $this->getJson(route('whiteboards.snapshot.show', Whiteboard::factory()->create()))
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Your session has expired.');
});

it('lets the facilitator or a workspace admin delete the board', function () {
    Event::fake([WhiteboardDeleted::class]);

    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$member] = whiteboardMember($board);

    $this->actingAs($member)->deleteJson(route('whiteboards.destroy', $board))
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator or a workspace admin can delete this board.');

    $this->actingAs($facilitator)->deleteJson(route('whiteboards.destroy', $board))->assertNoContent();

    expect(Whiteboard::query()->count())->toBe(0);
    Event::assertDispatched(fn (WhiteboardDeleted $event) => $event->boardId === $board->id);

    $other = Whiteboard::factory()->create();

    $this->actingAs(workspaceManager($other->team->workspace))
        ->deleteJson(route('whiteboards.destroy', $other))
        ->assertNoContent();
});
