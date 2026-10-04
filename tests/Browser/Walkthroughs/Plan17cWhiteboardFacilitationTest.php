<?php

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

const P17cTools = '[role="toolbar"][aria-label="Facilitation tools"]';
const P17cLockedNotice = 'div[role="status"]:has-text("This board is locked.")';
const P17cLockedToast = '[data-sonner-toast]:has-text("This board is locked.")';
const P17cTimesUpToast = '[data-sonner-toast]:has-text("Time\'s up!")';
const P17cViewMode = '.whiteboard-canvas .excalidraw.excalidraw--view-mode';
const P17cCanvas = '.whiteboard-canvas canvas.excalidraw__canvas.interactive';
const P17cLeadingNotice = 'div[role="status"]:has-text("Everyone follows your view.")';
const P17cFollowingNotice = 'div[role="status"]:has-text("Following the facilitator")';
const P17cPausedNotice = 'div[role="status"]:has-text("Following paused")';
const P17cResume = 'div[role="status"] button:text-is("Resume")';
const P17cFollowSwitch = '[aria-label="Bring everyone to me"]';
const P17cZoomLabel = '[role="toolbar"][aria-label="Zoom"] [data-zoom-percent]';
const P17cZoomIn = '[role="toolbar"][aria-label="Zoom"] button[aria-label="Zoom in"]';
const P17cZoomOut = '[role="toolbar"][aria-label="Zoom"] button[aria-label="Zoom out"]';

function p17cTimerSeconds(mixed $page): int
{
    return (int) $page->script('() => { const [minutes, seconds] = document.querySelector(\'[role="timer"]\').textContent.trim().split(":").map(Number); return minutes * 60 + seconds; }');
}

it('[P17c-01a] shows the timer, lock and follow buttons to the facilitator only, and refuses the timer, the lock and follow-me to a member and to a guest', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $franPage->assertPresent(P17cTools.' [aria-label="Timer"]')
        ->assertPresent(P17cTools.' [aria-label="Lock the board"][aria-pressed="false"]')
        ->assertPresent(P17cTools.' [aria-label="Bring everyone to me"][aria-pressed="false"]')
        ->assertNotPresent('[role="timer"]');

    foreach ([$miaPage, $guestPage] as $page) {
        $page->assertPresent('[aria-label="Board menu"]')
            ->assertNotPresent(P17cTools)
            ->assertNotPresent('[aria-label="Timer"]')
            ->assertNotPresent('[aria-label="Lock the board"]')
            ->assertNotPresent('[aria-label="Bring everyone to me"]');

        $timer = $this->sendFromPage($page, 'PUT', "/whiteboards/{$board->id}/timer", ['seconds' => 60]);
        $lock = $this->sendFromPage($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['locked' => true]);
        $follow = $this->sendFromPage($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['follow_enabled' => true]);

        expect($timer['status'])->toBe(403)
            ->and($timer['body']['message'])->toBe('Only the facilitator can do this.')
            ->and($lock['status'])->toBe(403)
            ->and($lock['body']['message'])->toBe('Only the facilitator can do this.')
            ->and($follow['status'])->toBe(403)
            ->and($this->whiteboardSnapshot($page, $board)['me']['isFacilitator'])->toBeFalse();
    }

    $stored = $board->fresh();

    expect($stored->timer_ends_at)->toBeNull()
        ->and($stored->locked)->toBeFalse()
        ->and($stored->follow_enabled)->toBeFalse()
        ->and($this->whiteboardSnapshot($franPage, $board)['me']['isFacilitator'])->toBeTrue();

    $franPage->assertNotPresent('[role="timer"]')
        ->assertPresent(P17cTools.' [aria-label="Lock the board"][aria-pressed="false"]');
});

it('[P17c-01b] shows the facilitator and a guest the same countdown and the same end time, and removes it for both on Stop timer', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $stop = '[role="menuitem"]:has-text("Stop timer")';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $franPage->click('[aria-label="Timer"]')
        ->assertPresent('[role="menu"]')
        ->assertCount('[role="menu"] [role="menuitem"]', 5)
        ->assertAttribute($stop, 'aria-disabled', 'true')
        ->click('[role="menuitem"]:text-is("1 min")')
        ->assertNotPresent('[role="menu"]')
        ->assertPresent('[role="timer"]');

    $guestPage->assertPresent('[role="timer"]');

    $franSeconds = p17cTimerSeconds($franPage);
    $guestSeconds = p17cTimerSeconds($guestPage);
    $endsAt = $board->fresh()->timer_ends_at;

    expect($franSeconds)->toBeBetween(50, 61)
        ->and($guestSeconds)->toBeBetween(50, 61)
        ->and(abs($franSeconds - $guestSeconds))->toBeLessThanOrEqual(1)
        ->and($endsAt)->not->toBeNull()
        ->and($endsAt->getTimestamp() - now()->getTimestamp())->toBeBetween(50, 60)
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['timerEndsAt'])->toBe($endsAt->toIso8601String())
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBe($endsAt->toIso8601String());

    $franPage->click('[aria-label="Timer"]')
        ->assertPresent('[role="menu"]')
        ->assertAttributeMissing($stop, 'aria-disabled')
        ->click($stop)
        ->assertNotPresent('[role="menu"]')
        ->assertNotPresent('[role="timer"]');

    $guestPage->assertNotPresent('[role="timer"]')
        ->assertNotPresent(P17cTimesUpToast);

    expect($board->fresh()->timer_ends_at)->toBeNull()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBeNull();
});

it('[P17c-01c] shows the time-up notice in the top bar and as a toast to the facilitator and to a guest when the countdown reaches zero', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $started = $this->sendFromPage($franPage, 'PUT', "/whiteboards/{$board->id}/timer", ['seconds' => 10]);

    expect($started['status'])->toBe(200)
        ->and($started['body']['timerEndsAt'])->toBe($board->fresh()->timer_ends_at->toIso8601String());

    $franPage->assertPresent('[role="timer"]');
    $guestPage->assertPresent('[role="timer"]');

    expect(p17cTimerSeconds($franPage))->toBeBetween(1, 11)
        ->and(p17cTimerSeconds($guestPage))->toBeBetween(1, 11);

    $franPage->assertAttribute('[role="timer"]', 'aria-label', "Time's up!")
        ->assertPresent(P17cTimesUpToast);

    $guestPage->assertAttribute('[role="timer"]', 'aria-label', "Time's up!")
        ->assertPresent(P17cTimesUpToast);

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBe($started['body']['timerEndsAt']);
});

it('[P17c-01d] shows the remaining time to a guest who opens the board mid-countdown, and no timer once it ended more than five minutes ago', function () {
    ['board' => $board] = whiteboardWithFacilitator(['timer_ends_at' => now()->addSeconds(90)]);

    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent('[role="timer"]');

    expect(p17cTimerSeconds($guestPage))->toBeBetween(78, 91);

    Whiteboard::query()->whereKey($board->id)->update(['timer_ends_at' => now()->subMinute()]);

    $this->awaitRealtime($guestPage->navigate($this->whiteboardPath($board)));

    $guestPage->assertAttribute('[role="timer"]', 'aria-label', "Time's up!")
        ->assertNotPresent('[data-sonner-toast]');

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->not->toBeNull();

    Whiteboard::query()->whereKey($board->id)->update(['timer_ends_at' => now()->subMinutes(6)]);

    $this->awaitRealtime($guestPage->navigate($this->whiteboardPath($board)));

    $guestPage->assertSeeIn('header span > h1', 'Sprint board')
        ->assertNotPresent('[role="timer"]');

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBeNull()
        ->and($board->fresh()->timer_ends_at)->not->toBeNull();
});

it('[P17c-02a] puts a guest in view mode on a locked board, refuses the guest\'s writes with 403 and errors.locked, lets the facilitator edit, and gives the tools back on unlock', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $shapesTool = '[data-slot="canvas-tools"] [role="toolbar"][aria-label="Tools"] button[aria-keyshortcuts="R"]';
    $stickyTool = '[data-slot="canvas-tools"] [role="toolbar"][aria-label="Tools"] button[aria-keyshortcuts="N"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $shape = $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 300]);

    $this->awaitWhiteboardElements($guestPage, 1);

    $guestPage->assertPresent($stickyTool)
        ->assertPresent($shapesTool)
        ->assertNotPresent(P17cViewMode);

    $franPage->click('[aria-label="Lock the board"]')
        ->assertAriaAttribute('[aria-label="Unlock the board"]', 'pressed', 'true');

    $guestPage->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cViewMode)
        ->assertNotPresent($stickyTool)
        ->assertNotPresent($shapesTool);

    $franPage->assertPresent($stickyTool)
        ->assertPresent($shapesTool)
        ->assertNotPresent(P17cViewMode)
        ->assertDontSee('This board is locked.');

    $newElement = $this->writeWhiteboardElements($guestPage, $board, [sceneElement(['index' => 'a5', 'x' => 700, 'y' => 500])]);
    $move = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'version' => 2, 'versionNonce' => 4242, 'x' => 900]]);

    expect($board->fresh()->locked)->toBeTrue()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['locked'])->toBeTrue()
        ->and($newElement['status'])->toBe(403)
        ->and($newElement['body']['message'])->toBe('This board is locked.')
        ->and($newElement['body']['errors']['locked'])->toBe(['This board is locked.'])
        ->and($move['status'])->toBe(403)
        ->and($move['body']['errors']['locked'])->toBe(['This board is locked.'])
        ->and($board->fresh()->seq)->toBe(1)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data['x'])->toBe(300);

    $guestPage->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->addWhiteboardSticky($franPage, 'Sun');
    $this->awaitWhiteboardElements($guestPage, 2);

    $moved = $this->writeWhiteboardElements($franPage, $board, [[...$shape, 'version' => 2, 'versionNonce' => 7001, 'x' => 250]]);

    expect($moved['status'])->toBe(200)
        ->and($moved['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $received = collect($this->whiteboardElements($guestPage, $board))->firstWhere('id', $shape['id']);

    expect($received['x'])->toBe(250)
        ->and($received['version'])->toBe(2)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(2);

    $franPage->click('[aria-label="Unlock the board"]')
        ->assertAriaAttribute('[aria-label="Lock the board"]', 'pressed', 'false');

    $guestPage->assertDontSee('This board is locked.')
        ->assertNotPresent(P17cViewMode)
        ->assertPresent($stickyTool)
        ->assertPresent($shapesTool);

    $this->addWhiteboardSticky($guestPage, 'Sky');
    $this->awaitWhiteboardStored($guestPage, $board, 3);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 3);

    expect($board->fresh()->locked)->toBeFalse()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['locked'])->toBeFalse()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->count())->toBe(2);
});

it('[P17c-02b] drops the note a guest adds on a board that was locked behind the open page, says the board is locked and keeps the guest on the board', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);
    $this->awaitResync($guestPage);

    Whiteboard::query()->whereKey($board->id)->update(['locked' => true]);

    $guestPage->assertPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent(P17cViewMode);

    $this->addWhiteboardSticky($guestPage, 'Moss');

    $guestPage->assertPresent(P17cLockedToast)
        ->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cViewMode)
        ->assertNotPresent('button[aria-label="Sticky note"]')
        ->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->awaitWhiteboardElements($guestPage, 0);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 0);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0)
        ->and($board->fresh()->seq)->toBe(0)
        ->and($this->whiteboardElements($franPage, $board))->toBeArray()->toBeEmpty();
});

it('[P17c-02c] closes the text a guest is typing when the facilitator locks the board, and stores nothing more of it during the lock or after the unlock', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $editor = '.whiteboard-canvas textarea.excalidraw-wysiwyg';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);

    $this->drawOnWhiteboard($guestPage, 'text', [600, 400], [600, 400]);

    $guestPage->assertPresent($editor)
        ->fill($editor, 'unsent words');

    $this->awaitWhiteboardStored($guestPage, $board, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 1);

    $typed = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();
    $seq = $board->fresh()->seq;

    expect($typed->type)->toBe('text')
        ->and($typed->data['text'])->toBe('unsent words');

    $franPage->click('[aria-label="Lock the board"]')
        ->assertAriaAttribute('[aria-label="Unlock the board"]', 'pressed', 'true');

    $guestPage->assertPresent(P17cLockedNotice)
        ->assertNotPresent($editor)
        ->assertPresent(P17cViewMode)
        ->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->awaitWhiteboardScene($guestPage, $board);
    $this->settleWhiteboard($guestPage, 800);

    $duringLock = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($board->fresh()->seq)->toBe($seq)
        ->and($duringLock->version)->toBe($typed->version)
        ->and($duringLock->data['text'])->toBe('unsent words')
        ->and($this->whiteboardElements($franPage, $board)[0]['text'])->toBe('unsent words');

    $franPage->click('[aria-label="Unlock the board"]');

    $guestPage->assertPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent($editor);

    $this->settleWhiteboard($guestPage, 800);

    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    expect($board->fresh()->seq)->toBe($seq)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data['text'])->toBe('unsent words');
});

it('[P17c-02d] keeps the View mode entry of the canvas menu on an unlocked board, and shows Unlock all elements to the facilitator only', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');
    $viewMode = '.whiteboard-canvas .context-menu li[data-testid="viewMode"]';
    $unlockAll = '.whiteboard-canvas .context-menu li[data-testid="unlockAllElements"]';
    $unlockAllDisplay = "getComputedStyle(document.querySelector('{$unlockAll}')).display";

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));

    $this->addWhiteboardElement($franPage, $board, ['x' => 60, 'y' => 60, 'width' => 120, 'height' => 80, 'locked' => true]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($miaPage, 1);

    $miaPage->assertAttribute('.whiteboard-canvas', 'data-facilitator', 'false')
        ->rightClick(P17cCanvas)
        ->assertPresent('.whiteboard-canvas .context-menu')
        ->assertPresent($viewMode)
        ->assertSeeIn($viewMode, 'View mode')
        ->assertPresent($unlockAll)
        ->assertScript($unlockAllDisplay, 'none');

    $franPage->assertAttribute('.whiteboard-canvas', 'data-facilitator', 'true')
        ->rightClick(P17cCanvas)
        ->assertPresent($viewMode)
        ->assertPresent($unlockAll)
        ->assertScript("{$unlockAllDisplay} != 'none'", true);
});

it('[P17c-03a] rejects a guest\'s move, unlock and deletion of a shape the facilitator locked, hands back the stored copy, and accepts them once the facilitator unlocked it', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $shape = $this->addWhiteboardElement($franPage, $board, ['x' => 250, 'y' => 300, 'locked' => true]);

    $this->awaitWhiteboardElements($guestPage, 1);

    $unlock = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'locked' => false, 'version' => 2, 'versionNonce' => 4242, 'x' => 900]]);
    $delete = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'isDeleted' => true, 'version' => 2, 'versionNonce' => 4243]]);
    $forged = $this->writeWhiteboardElements($guestPage, $board, [sceneElement(['id' => 'p17cGuestLock', 'index' => 'a5', 'locked' => true])]);

    expect($unlock['status'])->toBe(200)
        ->and($unlock['body']['seq'])->toBe($unlock['body']['fromSeq'])
        ->and($unlock['body']['rejected'])->toHaveCount(1)
        ->and($unlock['body']['rejected'][0]['id'])->toBe($shape['id'])
        ->and($unlock['body']['rejected'][0]['reason'])->toBe('locked')
        ->and($unlock['body']['rejected'][0]['element']['x'])->toBe(250)
        ->and($unlock['body']['rejected'][0]['element']['version'])->toBe(1)
        ->and($unlock['body']['rejected'][0]['element']['locked'])->toBeTrue()
        ->and($delete['status'])->toBe(200)
        ->and($delete['body']['rejected'][0]['reason'])->toBe('locked')
        ->and($delete['body']['rejected'][0]['element']['isDeleted'])->toBeFalse()
        ->and($forged['status'])->toBe(200)
        ->and($forged['body']['rejected'][0]['reason'])->toBe('locked')
        ->and($forged['body']['rejected'][0]['element'])->toBeNull();

    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($stored->version)->toBe(1)
        ->and($stored->is_deleted)->toBeFalse()
        ->and($stored->data['x'])->toBe(250)
        ->and($stored->data['locked'])->toBeTrue()
        ->and($board->fresh()->seq)->toBe(1);

    $guestPage->assertPresent('[data-realtime="connected"]')
        ->assertNotPresent(P17cLockedNotice);

    $released = $this->writeWhiteboardElements($franPage, $board, [[...$shape, 'locked' => false, 'version' => 2, 'versionNonce' => 7001]]);
    $moved = $this->writeWhiteboardElements($guestPage, $board, [[...$shape, 'locked' => false, 'version' => 3, 'versionNonce' => 4244, 'x' => 900]]);

    expect($released['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($moved['status'])->toBe(200)
        ->and($moved['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    $stored->refresh();

    expect($stored->version)->toBe(3)
        ->and($stored->data['x'])->toBe(900)
        ->and($stored->data['locked'])->toBeFalse();
});

it('[P17c-03b] lets the facilitator lock a shape from the canvas menu, hides the lock entry from a guest, and puts the shape back when the guest deletes it', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $lockEntry = '.whiteboard-canvas .context-menu li[data-testid="toggleElementLock"]';
    $lockEntryDisplay = "getComputedStyle(document.querySelector('{$lockEntry}')).display";
    $versions = "document.querySelector('[data-scene]').dataset.scene.split(':')[1]";

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $shape = $this->addWhiteboardElement($franPage, $board, [
        'x' => 500,
        'y' => 250,
        'width' => 700,
        'height' => 500,
        'backgroundColor' => '#a5d8ff',
        'roughness' => 0,
    ]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $franPage->rightClick(P17cCanvas)
        ->assertPresent($lockEntry)
        ->assertScript("{$lockEntryDisplay} != 'none'", true)
        ->click("{$lockEntry} button")
        ->assertNotPresent('.whiteboard-canvas .context-menu')
        ->assertScript($versions, '2');

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $locked = WhiteboardElement::query()->where('element_id', $shape['id'])->sole();

    expect($locked->data['locked'])->toBeTrue()
        ->and($locked->version)->toBe(2);

    $guestPage->assertAttribute('.whiteboard-canvas', 'data-facilitator', 'false')
        ->rightClick(P17cCanvas)
        ->assertPresent($lockEntry)
        ->assertScript($lockEntryDisplay, 'none')
        ->click('.whiteboard-canvas .context-menu li[data-testid="deleteSelectedElements"] button')
        ->assertPresent('[data-sonner-toast]:has-text("Only the facilitator can change a locked element.")');

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 1);

    $locked->refresh();

    expect($locked->is_deleted)->toBeFalse()
        ->and($locked->version)->toBe(2)
        ->and($locked->data['locked'])->toBeTrue()
        ->and($this->whiteboardElements($guestPage, $board))->toHaveCount(1);

    $franPage->rightClick(P17cCanvas)
        ->assertPresent($lockEntry)
        ->assertSeeIn($lockEntry, 'Unlock')
        ->click("{$lockEntry} button")
        ->assertScript($versions, '3');

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    expect($locked->refresh()->data['locked'])->toBeFalse();
});

it('[P17c-04a] brings a guest to the facilitator\'s zoom, pauses the guest who zooms without moving the facilitator, and resumes at the facilitator\'s current view', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertSeeIn(P17cZoomLabel, '100 %')
            ->assertNotPresent('div[role="status"]');
    }

    $franPage->click(P17cFollowSwitch)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'true')
        ->assertPresent(P17cLeadingNotice);

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cPausedNotice);

    expect($board->fresh()->follow_enabled)->toBeTrue()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['followEnabled'])->toBeTrue();

    $franPage->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '110 %');

    $guestPage->assertSeeIn(P17cZoomLabel, '110 %');

    $this->settleWhiteboard($guestPage, 2400);

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cPausedNotice)
        ->assertSeeIn(P17cZoomLabel, '110 %');

    $guestPage->click(P17cZoomOut)
        ->assertSeeIn(P17cZoomLabel, '100 %')
        ->assertPresent(P17cPausedNotice)
        ->assertPresent(P17cResume)
        ->assertNotPresent(P17cFollowingNotice);

    $this->settleWhiteboard($franPage, 800);

    $franPage->assertSeeIn(P17cZoomLabel, '110 %')
        ->assertPresent(P17cLeadingNotice)
        ->assertNotPresent(P17cPausedNotice);

    $franPage->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '120 %');

    $this->settleWhiteboard($guestPage, 2400);

    $guestPage->assertSeeIn(P17cZoomLabel, '100 %')
        ->assertPresent(P17cPausedNotice);

    $guestPage->click(P17cResume)
        ->assertSeeIn(P17cZoomLabel, '120 %')
        ->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cResume);

    $franPage->assertSeeIn(P17cZoomLabel, '120 %');
});

it('[P17c-04b] brings a guest who joins while follow-me is on to the facilitator\'s view, and frees everyone when it is switched off', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator(['follow_enabled' => true]);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $franPage->assertPresent(P17cLeadingNotice)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'true')
        ->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '110 %')
        ->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '120 %');

    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertSeeIn(P17cZoomLabel, '120 %')
        ->assertNotPresent(P17cPausedNotice);

    $franPage->click(P17cFollowSwitch)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false')
        ->assertNotPresent('div[role="status"]');

    $guestPage->assertNotPresent('div[role="status"]');

    $guestPage->click(P17cZoomOut)
        ->assertSeeIn(P17cZoomLabel, '110 %');

    $this->settleWhiteboard($guestPage, 800);

    $guestPage->assertNotPresent('div[role="status"]')
        ->assertSeeIn(P17cZoomLabel, '110 %');

    $franPage->assertSeeIn(P17cZoomLabel, '120 %');

    expect($board->fresh()->follow_enabled)->toBeFalse()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['followEnabled'])->toBeFalse();
});

it('[P17c-04c] lets a guest in view mode on a locked board follow the facilitator, pause by zooming and resume', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator(['locked' => true, 'follow_enabled' => true]);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent(P17cViewMode)
        ->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cFollowingNotice);

    $franPage->click(P17cZoomIn)
        ->assertSeeIn(P17cZoomLabel, '110 %');

    $guestPage->assertSeeIn(P17cZoomLabel, '110 %')
        ->assertNotPresent(P17cPausedNotice);

    $guestPage->click(P17cZoomOut)
        ->assertSeeIn(P17cZoomLabel, '100 %')
        ->assertPresent(P17cPausedNotice)
        ->assertPresent(P17cLockedNotice);

    $guestPage->click(P17cResume)
        ->assertSeeIn(P17cZoomLabel, '110 %')
        ->assertPresent(P17cFollowingNotice)
        ->assertPresent(P17cViewMode);

    $franPage->assertSeeIn(P17cZoomLabel, '110 %');
});

it('[P17c-04d] zooms a follower with a narrower window out until the facilitator\'s view fits in it', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator(['follow_enabled' => true]);
    $size = '() => { const box = document.querySelector(".whiteboard-canvas").getBoundingClientRect(); return JSON.stringify([box.width, box.height]); }';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent(P17cFollowingNotice)
        ->assertSeeIn(P17cZoomLabel, '100 %');

    $guestPage->resize(900, 1117)
        ->assertScript('window.innerWidth', 900);

    [$franWidth, $franHeight] = json_decode((string) $franPage->script($size), true);
    [$guestWidth, $guestHeight] = json_decode((string) $guestPage->script($size), true);
    $fitted = min($guestWidth / $franWidth, $guestHeight / $franHeight);

    expect($fitted)->toBeGreaterThan(0.3)->toBeLessThan(0.6);

    $guestPage->assertSeeIn(P17cZoomLabel, number_format($fitted * 100).' %')
        ->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cPausedNotice);

    $franPage->assertSeeIn(P17cZoomLabel, '100 %');
});

it('[P17c-05a] lists the team members and the workspace admins in the hand-over dialog, hands facilitation over without a reload, switches follow-me off at each change, and lets the former facilitator take control back', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator();
    [$max, $maxMember] = whiteboardMember($board);
    renamedWhiteboardUser($max, 'Max Member');
    renamedWhiteboardUser(workspaceManager($board->team->workspace), 'Ada Admin');
    $handOver = '[role="dialog"] button:text-is("Hand over")';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $maxPage = $this->awaitRealtime($this->signIn($max, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $franPage->assertPresent('[role="group"][aria-label="3 online"]')
        ->click(P17cFollowSwitch)
        ->assertPresent(P17cLeadingNotice);

    $maxPage->assertPresent(P17cFollowingNotice)
        ->assertNotPresent(P17cTools);

    $this->openWhiteboardMenu($franPage)
        ->assertNotPresent('[role="menuitem"]:has-text("Take control")')
        ->click('[role="menuitem"]:has-text("Hand over facilitation")')
        ->assertPresent('[role="dialog"] #whiteboard-new-facilitator')
        ->assertDisabled($handOver)
        ->click('#whiteboard-new-facilitator')
        ->assertPresent('[role="listbox"]');

    $offered = json_decode((string) $franPage->script('() => JSON.stringify(Array.from(document.querySelectorAll(\'[role="listbox"] [role="option"]\')).map((option) => option.textContent.trim()))'), true);
    $candidates = array_column($this->whiteboardSnapshot($franPage, $board)['me']['transferCandidates'], 'name');

    expect($offered)->toBe(['Ada Admin', 'Max Member'])
        ->and($candidates)->toBe(['Ada Admin', 'Max Member'])
        ->and($this->whiteboardSnapshot($guestPage, $board)['me']['transferCandidates'])->toBeArray()->toBeEmpty();

    $franPage->click('[role="option"]:has-text("Max Member")')
        ->assertNotPresent('[role="listbox"]')
        ->click($handOver)
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent(P17cTools)
        ->assertNotPresent('div[role="status"]');

    $maxPage->assertPresent(P17cTools)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false')
        ->assertNotPresent('div[role="status"]');

    $afterHandOver = $this->whiteboardSnapshot($guestPage, $board)['board'];

    expect($board->fresh()->facilitator_member_id)->toBe($maxMember->id)
        ->and($board->fresh()->follow_enabled)->toBeFalse()
        ->and($afterHandOver['facilitatorMemberId'])->toBe($maxMember->id)
        ->and($afterHandOver['followEnabled'])->toBeFalse();

    $maxPage->click(P17cFollowSwitch)
        ->assertPresent(P17cLeadingNotice);

    $franPage->assertPresent(P17cFollowingNotice);
    $guestPage->assertPresent(P17cFollowingNotice);

    $this->openWhiteboardMenu($franPage)
        ->assertNotPresent('[role="menuitem"]:has-text("Hand over facilitation")')
        ->click('[role="menuitem"]:has-text("Take control")')
        ->assertNotPresent('[role="menu"]')
        ->assertPresent(P17cTools)
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false')
        ->assertNotPresent('div[role="status"]');

    $maxPage->assertNotPresent(P17cTools)
        ->assertNotPresent('div[role="status"]');

    $guestPage->assertNotPresent('div[role="status"]');

    $afterTakeOver = $this->whiteboardSnapshot($guestPage, $board)['board'];

    expect($board->fresh()->facilitator_member_id)->toBe($franMember->id)
        ->and($board->fresh()->follow_enabled)->toBeFalse()
        ->and($afterTakeOver['facilitatorMemberId'])->toBe($franMember->id)
        ->and($afterTakeOver['followEnabled'])->toBeFalse();
});

it('[P17c-05b] says that no one else can facilitate when the facilitator is alone in the team, and never offers or allows facilitation to a guest', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->openWhiteboardMenu($franPage)
        ->click('[role="menuitem"]:has-text("Hand over facilitation")')
        ->assertSeeIn('[role="dialog"]', 'No one else can facilitate this board yet.')
        ->assertNotPresent('[role="dialog"] #whiteboard-new-facilitator')
        ->assertNotPresent('[role="dialog"] button:text-is("Hand over")')
        ->click('[role="dialog"] button:text-is("Cancel")')
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent(P17cTools);

    $this->openWhiteboardMenu($guestPage)
        ->assertPresent('[role="menuitemcheckbox"]:has-text("Hide my cursor")')
        ->assertScript("Array.from(document.querySelectorAll('[role=\"menu\"] [role=\"menuitem\"]')).map((item) => item.innerText.trim()).join('|')", 'Save as image|Find on canvas|Canvas help|Clear canvas|Canvas background')
        ->assertDontSeeIn('[role="menu"]', 'Take control')
        ->assertDontSeeIn('[role="menu"]', 'Hand over facilitation');

    $attempt = $this->sendFromPage($guestPage, 'PUT', "/whiteboards/{$board->id}/facilitator", ['user_id' => $fran->id]);

    expect($attempt['status'])->toBe(403)
        ->and($attempt['body']['message'])->toBe('Only the facilitator can do this.')
        ->and($board->fresh()->facilitator_member_id)->toBe($franMember->id)
        ->and($this->whiteboardSnapshot($guestPage, $board)['me']['canTakeControl'])->toBeFalse();
});

it('[P17c-06] flies reactions both ways on a locked board with the sender\'s name, and removes the bar for everyone when the facilitator switches reactions off', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator(['locked' => true]);
    $bar = '.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent($bar);
    }

    $guestPage->assertPresent(P17cViewMode)
        ->assertPresent(P17cLockedNotice)
        ->click('[aria-label="Send a reaction ❤️"]');

    $franPage->assertSeeIn('.lr-overlay', '❤️')
        ->assertSeeIn('.lr-overlay', 'Guest Gia');

    $franPage->click('[aria-label="Send a reaction 🎉"]');

    $guestPage->assertSeeIn('.lr-overlay', '🎉')
        ->assertSeeIn('.lr-overlay', 'Fran Facilitator');

    $this->openWhiteboardMenu($franPage)
        ->assertAriaAttribute('[role="menuitemcheckbox"]:has-text("Show flying reactions")', 'checked', 'true')
        ->click('[role="menuitemcheckbox"]:has-text("Show flying reactions")');

    $guestPage->assertNotPresent($bar)
        ->assertPresent(P17cLockedNotice);

    $franPage->assertNotPresent($bar);

    expect($board->fresh()->reactions_enabled)->toBeFalse()
        ->and($board->fresh()->locked)->toBeTrue();
});

it('[P17c-07] names no canvas library and shows no outbound link on a board with the timer, the lock and follow-me in use', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator(['locked' => true, 'follow_enabled' => true, 'timer_ends_at' => now()->addMinutes(5)]);
    $scan = '() => { const words = [document.body.innerText, ...Array.from(document.querySelectorAll("[aria-label], [title]")).flatMap((node) => [node.getAttribute("aria-label") ?? "", node.getAttribute("title") ?? ""])].join("\n").toLowerCase(); const links = Array.from(document.querySelectorAll("a[href]")).filter((link) => link.getClientRects().length > 0 && new URL(link.href, location.href).origin !== location.origin).length; return JSON.stringify({ named: words.includes("excalidraw"), links }); }';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $franPage->assertPresent(P17cLeadingNotice)
        ->assertPresent('[role="timer"]')
        ->click('[aria-label="Timer"]')
        ->assertPresent('[role="menuitem"]:has-text("Stop timer")');

    $guestPage->assertPresent(P17cLockedNotice)
        ->assertPresent(P17cFollowingNotice)
        ->assertPresent('[role="timer"]');

    expect(json_decode((string) $franPage->script($scan), true))->toBe(['named' => false, 'links' => 0])
        ->and(json_decode((string) $guestPage->script($scan), true))->toBe(['named' => false, 'links' => 0]);
});

it('[P17c-08] duplicates a locked board with a running timer and follow-me into a copy that has none of them, and keeps a locked shape locked', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator(['locked' => true, 'follow_enabled' => true, 'timer_ends_at' => now()->addMinutes(5)]);

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $shape = $this->addWhiteboardElement($page, $board, ['x' => 300, 'y' => 300, 'locked' => true]);

    $this->awaitWhiteboardElements($page, 1);

    $page->assertPresent('[role="timer"]')
        ->assertAriaAttribute('[aria-label="Unlock the board"]', 'pressed', 'true')
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'true');

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Duplicate this board")')
        ->assertSeeIn('header span > h1', 'Sprint board (copy)');

    $copy = Whiteboard::query()->where('title', 'Sprint board (copy)')->sole();

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertPathIs($this->whiteboardPath($copy))
        ->assertNotPresent('[role="timer"]')
        ->assertNotPresent('div[role="status"]')
        ->assertAriaAttribute('[aria-label="Lock the board"]', 'pressed', 'false')
        ->assertAriaAttribute(P17cFollowSwitch, 'pressed', 'false');

    $copied = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->sole();
    $snapshot = $this->whiteboardSnapshot($page, $copy);

    expect($copy->id)->not->toBe($board->id)
        ->and($copy->locked)->toBeFalse()
        ->and($copy->follow_enabled)->toBeFalse()
        ->and($copy->timer_ends_at)->toBeNull()
        ->and($copied->element_id)->not->toBe($shape['id'])
        ->and($copied->data['locked'])->toBeTrue()
        ->and($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['board']['timerEndsAt'])->toBeNull()
        ->and($board->fresh()->locked)->toBeTrue()
        ->and($board->fresh()->timer_ends_at)->not->toBeNull();
});
