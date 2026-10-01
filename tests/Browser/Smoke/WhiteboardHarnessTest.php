<?php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('shows a guest an element a member writes to the board, without a reload', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Harness board']);
    [$member] = whiteboardFacilitator($board);
    $member->update(['locale' => 'en']);

    $memberPage = $this->awaitRealtime($this->signIn($member, "/whiteboards/{$board->id}"));
    $guestPage = $this->awaitRealtime($this->joinAsGuest("/whiteboards/join/{$board->guest_token}", 'Guest Gia'));

    $this->awaitWhiteboardElements($memberPage, 0);
    $this->awaitWhiteboardElements($guestPage, 0);

    $element = $this->addWhiteboardElement($memberPage, $board);

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($memberPage, $board);

    $received = $this->whiteboardElements($guestPage, $board);

    expect($received)->toHaveCount(1)
        ->and($received[0]['id'])->toBe($element['id'])
        ->and($this->whiteboardSceneStamp($board))->toBe("1:1:{$element['versionNonce']}")
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(1);
});

it('stores a rectangle drawn on the canvas with the pointer', function () {
    $board = Whiteboard::factory()->create(['title' => 'Harness board']);
    [$member] = whiteboardFacilitator($board);
    $member->update(['locale' => 'en']);

    $page = $this->awaitRealtime($this->signIn($member, "/whiteboards/{$board->id}"));

    $this->awaitWhiteboardElements($page, 0);

    $this->drawOnWhiteboard($page, 'rectangle', [500, 300], [700, 450]);

    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    $rectangle = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($rectangle->type)->toBe('rectangle')
        ->and($rectangle->is_deleted)->toBeFalse()
        ->and($rectangle->data['x'])->toEqualWithDelta(500, 2)
        ->and($rectangle->data['y'])->toEqualWithDelta(300, 2)
        ->and($rectangle->data['width'])->toEqualWithDelta(200, 2)
        ->and($rectangle->data['height'])->toEqualWithDelta(150, 2);
});
