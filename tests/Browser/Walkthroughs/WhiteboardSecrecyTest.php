<?php

use App\Models\WhiteboardElement;

it('types a note into a sticky note by double-click, stores the text on the server and shows it to a second participant', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $editor = '.whiteboard-canvas textarea.excalidraw-wysiwyg';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($franPage, 0);
    $this->awaitWhiteboardElements($guestPage, 0);

    $this->addWhiteboardSticky($franPage, 'Sun');

    $this->awaitWhiteboardStored($franPage, $board, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $sticky = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    $this->doubleClickOnWhiteboard($franPage, [
        $sticky->data['x'] + ($sticky->data['width'] / 2),
        $sticky->data['y'] + ($sticky->data['height'] / 2),
    ]);

    $franPage->assertPresent($editor)
        ->fill($editor, 'Public note');

    $this->awaitWhiteboardStored($franPage, $board, 2);

    $this->dragOnWhiteboard($franPage, [1100, 650], [1100, 650]);

    $franPage->assertNotPresent($editor);

    $this->awaitWhiteboardElements($guestPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $text = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('type', 'text')->sole();
    $received = collect($this->whiteboardElements($guestPage, $board))->firstWhere('type', 'text');

    expect($text->data['text'])->toBe('Public note')
        ->and($text->data['containerId'])->toBe($sticky->element_id)
        ->and($text->is_deleted)->toBeFalse()
        ->and($received['text'])->toBe('Public note')
        ->and($received['containerId'])->toBe($sticky->element_id);
});

it('locks and unlocks the board from the top bar, and another member cannot write while it is locked', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedUser($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($miaPage, 0);

    $miaPage->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertDontSee('This board is locked.');

    $franPage->assertPresent('button[aria-label="Lock the board"][aria-pressed="false"]')
        ->click('button[aria-label="Lock the board"]')
        ->assertPresent('button[aria-label="Unlock the board"][aria-pressed="true"]')
        ->assertDontSee('This board is locked.');

    $miaPage->assertSee('This board is locked.');

    $refused = $this->writeWhiteboardElements($miaPage, $board, [sceneElement()]);

    expect($board->fresh()->locked)->toBeTrue()
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['locked'])->toBeTrue()
        ->and($this->whiteboardSnapshot($miaPage, $board)['board']['locked'])->toBeTrue()
        ->and($refused['status'])->toBe(403)
        ->and($refused['body']['errors']['locked'][0])->toBe('This board is locked.')
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 200]);
    $this->awaitWhiteboardElements($miaPage, 1);

    $franPage->click('button[aria-label="Unlock the board"]')
        ->assertPresent('button[aria-label="Lock the board"][aria-pressed="false"]');

    $miaPage->assertDontSee('This board is locked.');

    expect($board->fresh()->locked)->toBeFalse()
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['locked'])->toBeFalse()
        ->and($this->whiteboardSnapshot($miaPage, $board)['board']['locked'])->toBeFalse();

    $this->addWhiteboardElement($miaPage, $board, ['x' => 700, 'y' => 200]);
    $this->awaitWhiteboardElements($franPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($miaPage, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(2);
});

it('refuses a change of the settings sent by a guest with 403 and changes nothing', function () {
    ['board' => $board] = whiteboardWithFacilitator();

    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $guestPage->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertNotPresent('button[aria-label="Lock the board"]');

    $answer = $this->sendFromPage($guestPage, 'PATCH', route('whiteboards.settings.update', $board, false), [
        'title' => 'Taken over',
        'locked' => true,
        'guest_access_enabled' => false,
    ]);

    $snapshot = $this->whiteboardSnapshot($guestPage, $board);
    $stored = $board->fresh();

    expect($answer['status'])->toBe(403)
        ->and($answer['body']['message'])->toBe('Only the facilitator can do this.')
        ->and($stored->title)->toBe('Sprint board')
        ->and($stored->locked)->toBeFalse()
        ->and($stored->guest_access_enabled)->toBeTrue()
        ->and($snapshot['me']['isGuest'])->toBeTrue()
        ->and($snapshot['me']['isFacilitator'])->toBeFalse()
        ->and($snapshot['board']['title'])->toBe('Sprint board')
        ->and($snapshot['board']['locked'])->toBeFalse()
        ->and($snapshot['board']['guestUrl'])->toBeNull()
        ->and($snapshot['links']['team'])->toBeNull();

    $guestPage->assertSeeIn('header span > h1', 'Sprint board')
        ->assertPresent('[data-realtime="connected"]');
});
