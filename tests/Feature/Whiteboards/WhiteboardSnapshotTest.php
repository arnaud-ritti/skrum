<?php

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
        ->assertJsonPath('me.id', $member->id)
        ->assertJsonPath('me.userId', $user->id)
        ->assertJsonPath('me.isFacilitator', true)
        ->assertJsonPath('me.canDelete', true)
        ->assertJsonPath('me.canTakeControl', false)
        ->assertJsonCount(1, 'members')
        ->assertJsonCount(1, 'elements')
        ->assertJsonPath('elements.0.id', $live->element_id)
        ->assertJsonPath('seq', 7)
        ->assertJsonPath('links.team', route('teams.show', [$board->team->workspace, $board->team], absolute: false));
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
        ->assertJsonPath('me.canTakeControl', false);

    expect($response->getContent())->not->toContain($board->guest_token);
});
