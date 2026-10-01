<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;

it('lets the facilitator hand over to a team member', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $next = teamMember($board->team);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $next->id])
        ->assertNoContent();

    expect($board->fresh()->facilitator?->user_id)->toBe($next->id);
});

it('refuses a hand-over to someone outside the team', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $outsider->id])
        ->assertJsonValidationErrors('user_id');
});

it('lets a team member take control for themselves only', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    [$other] = whiteboardMember($board);

    $this->actingAs($user)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $other->id])
        ->assertForbidden();

    $this->actingAs($user)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $user->id])
        ->assertNoContent();

    expect($board->fresh()->facilitator?->user_id)->toBe($user->id);
});

it('never lets a guest facilitate', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))
        ->withCredentials()
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $facilitator->id])
        ->assertForbidden();
});
