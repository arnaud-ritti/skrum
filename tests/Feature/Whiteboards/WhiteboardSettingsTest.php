<?php

use App\Events\Whiteboards\WhiteboardChanged;
use App\Models\Whiteboard;
use App\Support\Sessions\JoinCodes;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

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

it('lets the facilitator switch flying reactions off and on again', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['reactions_enabled' => false])
        ->assertNoContent();

    expect($board->fresh()->reactions_enabled)->toBeFalse();

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['reactions_enabled' => true])
        ->assertNoContent();

    expect($board->fresh()->reactions_enabled)->toBeTrue();

    Event::assertDispatchedTimes(WhiteboardChanged::class, 2);
});

it('refuses the reactions switch from anyone else', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['reactions_enabled' => false])
        ->assertForbidden();

    expect($board->fresh()->reactions_enabled)->toBeTrue();
});

it('refuses a reactions switch that is not a boolean', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['reactions_enabled' => 'sometimes'])
        ->assertJsonValidationErrors('reactions_enabled');
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
    $oldJoinCode = resolve(JoinCodes::class)->for($board);

    $response = $this->actingAs($user)
        ->postJson(route('whiteboards.guestToken.store', $board))
        ->assertOk();

    $board->refresh();

    expect($board->guest_token)->not->toBe($oldToken)
        ->and($response->json('guestUrl'))->toBe(route('whiteboards.join.show', $board->guest_token))
        ->and($response->json('joinCode'))->toBe(resolve(JoinCodes::class)->for($board))
        ->and($response->json('joinCode'))->not->toBe($oldJoinCode)
        ->and($guest->fresh()->guest_secret_hash)->toBeNull()
        ->and($guest->fresh()->guest_name)->not->toBeNull();

    auth()->logout();

    $this->withCookies(whiteboardGuestCookie($guest))
        ->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertForbidden();
});

it('refuses to regenerate the guest link for a member or a guest', function (Closure $request) {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    $oldToken = $board->guest_token;

    $request($this, $board)->postJson(route('whiteboards.guestToken.store', $board))->assertForbidden();

    expect($board->fresh()->guest_token)->toBe($oldToken);
})->with([
    'member' => [fn (TestCase $test, Whiteboard $board) => $test->actingAs(whiteboardMember($board)[0])],
    'guest' => [fn (TestCase $test, Whiteboard $board) => $test->withCookies(whiteboardGuestCookie(whiteboardGuest($board)))->withCredentials()],
]);

it('lets the facilitator lock the board and bring everyone to their view', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['locked' => true, 'follow_enabled' => true])
        ->assertNoContent();

    expect($board->fresh()->locked)->toBeTrue()
        ->and($board->fresh()->follow_enabled)->toBeTrue();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertJsonPath('board.locked', true)
        ->assertJsonPath('board.followEnabled', true);

    Event::assertDispatched(WhiteboardChanged::class);
});

it('refuses the lock and follow switches from anyone else, and values that are not booleans', function (string $key) {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), [$key => true])
        ->assertForbidden();

    $this->actingAs($facilitator)
        ->patchJson(route('whiteboards.settings.update', $board), [$key => 'sometimes'])
        ->assertJsonValidationErrors($key);

    expect($board->fresh()->getAttribute($key))->toBeFalse();
})->with(['locked', 'follow_enabled']);
