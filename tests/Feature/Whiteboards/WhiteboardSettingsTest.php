<?php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Models\Whiteboard;
use Illuminate\Support\Facades\Event;

it('lets the facilitator change the title and the switches', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), [
            'title' => 'Renamed',
            'guest_access_enabled' => true,
            'cursors_enabled' => false,
        ])
        ->assertNoContent();

    $board->refresh();

    expect($board->title)->toBe('Renamed')
        ->and($board->guest_access_enabled)->toBeTrue()
        ->and($board->cursors_enabled)->toBeFalse();

    Event::assertDispatched(WhiteboardChanged::class);
});

it('refuses settings from anyone else', function () {
    $board = Whiteboard::factory()->create(['title' => 'Kept']);
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['title' => 'Hijacked'])
        ->assertForbidden();

    expect($board->fresh()->title)->toBe('Kept');
});

it('validates the title', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['title' => ''])
        ->assertJsonValidationErrors('title');
});

it('regenerates the guest link and signs every guest out', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    $oldToken = $board->guest_token;

    $response = $this->actingAs($user)
        ->postJson(route('whiteboards.guestToken.store', $board))
        ->assertOk();

    $board->refresh();

    expect($board->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('whiteboards.join.show', $board->guest_token))
        ->and($guest->fresh()->guest_secret_hash)->toBeNull()
        ->and($guest->fresh()->guest_name)->not->toBeNull();

    auth()->logout();

    $this->withCookies(whiteboardGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();
});
