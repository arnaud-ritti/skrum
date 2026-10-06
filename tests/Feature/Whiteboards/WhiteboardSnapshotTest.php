<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('describes the board, the viewer, the members and the live elements', function () {
    $board = Whiteboard::factory()->create(['title' => 'Map', 'seq' => 7]);
    [$user, $member] = whiteboardFacilitator($board);
    $live = WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'seq' => 3]);
    WhiteboardElement::factory()->deleted()->create(['whiteboard_id' => $board->id, 'seq' => 7]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.title', 'Map')
        ->assertJsonPath('board.facilitatorMemberId', $member->id)
        ->assertJsonPath('board.guestUrl', route('whiteboards.join.show', $board->guest_token))
        ->assertJsonPath('board.cursorsEnabled', true)
        ->assertJsonPath('board.reactionsEnabled', true)
        ->assertJsonPath('board.locked', false)
        ->assertJsonPath('board.followEnabled', false)
        ->assertJsonPath('board.timerEndsAt', null)
        ->assertJsonPath('me.id', $member->id)
        ->assertJsonPath('me.userId', $user->id)
        ->assertJsonPath('me.isFacilitator', true)
        ->assertJsonPath('me.canDelete', true)
        ->assertJsonPath('me.canTakeControl', false)
        ->assertJsonCount(1, 'members')
        ->assertJsonCount(1, 'elements')
        ->assertJsonPath('elements.0.id', $live->element_id)
        ->assertJsonPath('seq', 7)
        ->assertJsonPath('links.team', route('teams.show', [$board->team->workspace, $board->team], absolute: false))
        ->assertJsonPath('links.sessions', route('teams.sessions.index', [$board->team->workspace, $board->team, 'kind' => 'whiteboard'], absolute: false));
});

it('returns the elements in the order of their index, not of their writes', function () {
    $board = Whiteboard::factory()->create(['seq' => 4]);
    [$user] = whiteboardMember($board);

    foreach ([['moved', 'a0', 4], ['top', 'a2', 2], ['bottom', 'Zz', 3]] as [$id, $index, $seq]) {
        WhiteboardElement::factory()->create([
            'whiteboard_id' => $board->id, 'element_id' => $id, 'seq' => $seq, 'data' => sceneElement(['id' => $id, 'index' => $index]),
        ]);
    }

    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'unplaced', 'seq' => 1]);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('elements.*.id', ['bottom', 'moved', 'top', 'unplaced']);

    $this->actingAs($user)
        ->get(route('whiteboards.show', $board))
        ->assertInertia(fn ($page) => $page->where('snapshot.elements.0.id', 'bottom')->where('snapshot.elements.3.id', 'unplaced'));
});

it('lets a non-facilitating member take control but not delete', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('me.isFacilitator', false)
        ->assertJsonPath('me.canTakeControl', true)
        ->assertJsonPath('me.canDelete', false);
});

it('hides the guest link, the team link and the token from guests', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    $response = $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.guestUrl', null)
        ->assertJsonPath('links.team', null)
        ->assertJsonPath('links.sessions', null)
        ->assertJsonPath('me.canTakeControl', false);

    expect($response->getContent())->not->toContain($board->guest_token);
});

it('names the team of the board for a member and not for a guest', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.teamName', $board->team->name);

    auth()->logout();

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('board.teamName', null);
});

it('gives the server time to the millisecond', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    $serverTime = $this->actingAs($user)->getJson(route('whiteboards.snapshot.show', $board))->json('serverTime');

    expect($serverTime)->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/');
});

it('offers the facilitator the people who can take over, by name', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardFacilitator($board);
    $zoe = teamMember($board->team);
    $zoe->forceFill(['name' => 'Zoe'])->save();
    $adam = workspaceManager($board->team->workspace);
    $adam->forceFill(['name' => 'Adam'])->save();
    $outsider = User::factory()->create(['name' => 'Olaf']);
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    whiteboardGuest($board);

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('me.transferCandidates', [
            ['userId' => $adam->id, 'name' => 'Adam', 'avatarUrl' => $adam->avatarUrl()],
            ['userId' => $zoe->id, 'name' => 'Zoe', 'avatarUrl' => $zoe->avatarUrl()],
        ]);

    $this->actingAs($zoe)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('me.transferCandidates', []);
});
