<?php

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

const P17cTools = '[role="toolbar"][aria-label="Facilitation tools"]';
const P17cLockedNotice = 'div[role="status"]:has-text("This board is locked.")';
const P17cLockedToast = '[data-sonner-toast]:has-text("This board is locked.")';
const P17cTimesUpToast = '[data-sonner-toast]:has-text("Time\'s up!")';
const P17cViewMode = '.whiteboard-canvas .excalidraw.excalidraw--view-mode';
const P17cCanvas = '.whiteboard-canvas canvas.excalidraw__canvas.interactive';

function p17cRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17cBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'fran' => p17cRenamed($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

function p17cBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
}

function p17cJoinPath(Whiteboard $board): string
{
    return "/whiteboards/join/{$board->fresh()->guest_token}";
}

/**
 * @param  array<string, mixed>  $body
 * @return array{
 *     status: int,
 *     body: array<string, mixed>
 * }
 */
function p17cSend(mixed $page, string $method, string $path, array $body): array
{
    $request = json_encode([
        'method' => $method,
        'path' => $path,
        'body' => json_encode($body, JSON_THROW_ON_ERROR),
    ], JSON_THROW_ON_ERROR);

    $answer = json_decode((string) $page->script(<<<JS
        async () => {
            const request = {$request};
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const response = await fetch(request.path, {
                method: request.method,
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                },
                body: request.body,
            });

            return JSON.stringify({ status: response.status, body: await response.text() });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
}

function p17cPause(mixed $page, int $milliseconds): void
{
    for ($waited = 0; $waited < $milliseconds; $waited += 400) {
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 400))');
    }
}

function p17cTimerSeconds(mixed $page): int
{
    return (int) $page->script('() => { const [minutes, seconds] = document.querySelector(\'[role="timer"]\').textContent.trim().split(":").map(Number); return minutes * 60 + seconds; }');
}

it('[P17c-01a] shows the timer, lock and follow buttons to the facilitator only, and refuses the timer, the lock and follow-me to a member and to a guest', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    [$mia] = whiteboardMember($board);
    p17cRenamed($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

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

        $timer = p17cSend($page, 'PUT', "/whiteboards/{$board->id}/timer", ['seconds' => 60]);
        $lock = p17cSend($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['locked' => true]);
        $follow = p17cSend($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['follow_enabled' => true]);

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
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $stop = '[role="menuitem"]:has-text("Stop timer")';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

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
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $started = p17cSend($franPage, 'PUT', "/whiteboards/{$board->id}/timer", ['seconds' => 10]);

    expect($started['status'])->toBe(200)
        ->and($started['body']['timerEndsAt'])->toBe($board->fresh()->timer_ends_at->toIso8601String());

    $franPage->assertPresent('[role="timer"]');
    $guestPage->assertPresent('[role="timer"]');

    expect(p17cTimerSeconds($franPage))->toBeBetween(1, 11)
        ->and(p17cTimerSeconds($guestPage))->toBeBetween(1, 11);

    $franPage->assertSeeIn('[role="timer"]', "Time's up!")
        ->assertPresent(P17cTimesUpToast);

    $guestPage->assertSeeIn('[role="timer"]', "Time's up!")
        ->assertPresent(P17cTimesUpToast);

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBe($started['body']['timerEndsAt']);
});

it('[P17c-01d] shows the remaining time to a guest who opens the board mid-countdown, and no timer once it ended more than five minutes ago', function () {
    ['board' => $board] = p17cBoard(['timer_ends_at' => now()->addSeconds(90)]);

    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $guestPage->assertPresent('[role="timer"]');

    expect(p17cTimerSeconds($guestPage))->toBeBetween(78, 91);

    Whiteboard::query()->whereKey($board->id)->update(['timer_ends_at' => now()->subMinute()]);

    $this->awaitRealtime($guestPage->navigate(p17cBoardPath($board)));

    $guestPage->assertSeeIn('[role="timer"]', "Time's up!")
        ->assertNotPresent('[data-sonner-toast]');

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->not->toBeNull();

    Whiteboard::query()->whereKey($board->id)->update(['timer_ends_at' => now()->subMinutes(6)]);

    $this->awaitRealtime($guestPage->navigate(p17cBoardPath($board)));

    $guestPage->assertSeeIn('header > h1', 'Sprint board')
        ->assertNotPresent('[role="timer"]');

    expect($this->whiteboardSnapshot($guestPage, $board)['board']['timerEndsAt'])->toBeNull()
        ->and($board->fresh()->timer_ends_at)->not->toBeNull();
});

it('[P17c-02a] puts a guest in view mode on a locked board, refuses the guest\'s writes with 403 and errors.locked, lets the facilitator edit, and gives the tools back on unlock', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $shapesTool = '.whiteboard-canvas [data-testid="toolbar-rectangle"]';
    $stickyTool = 'button[aria-label="Sticky note"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

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

    $this->addWhiteboardSticky($franPage, 'Yellow');
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

    $this->addWhiteboardSticky($guestPage, 'Blue');
    $this->awaitWhiteboardStored($guestPage, $board, 3);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardElements($franPage, 3);

    expect($board->fresh()->locked)->toBeFalse()
        ->and($this->whiteboardSnapshot($guestPage, $board)['board']['locked'])->toBeFalse()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->count())->toBe(2);
});

it('[P17c-02b] drops the note a guest adds on a board that was locked behind the open page, says the board is locked and keeps the guest on the board', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);
    $this->awaitResync($guestPage);

    Whiteboard::query()->whereKey($board->id)->update(['locked' => true]);

    $guestPage->assertPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent(P17cViewMode);

    $this->addWhiteboardSticky($guestPage, 'Green');

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
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $editor = '.whiteboard-canvas textarea.excalidraw-wysiwyg';

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

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
        ->assertPresent(P17cLockedToast)
        ->assertPresent('[data-realtime="connected"]')
        ->assertDontSee('Your access to this board has ended.');

    $this->awaitWhiteboardScene($guestPage, $board);
    p17cPause($guestPage, 800);

    $duringLock = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($board->fresh()->seq)->toBe($seq)
        ->and($duringLock->version)->toBe($typed->version)
        ->and($duringLock->data['text'])->toBe('unsent words')
        ->and($this->whiteboardElements($franPage, $board)[0]['text'])->toBe('unsent words');

    $franPage->click('[aria-label="Unlock the board"]');

    $guestPage->assertPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent($editor);

    p17cPause($guestPage, 800);

    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    expect($board->fresh()->seq)->toBe($seq)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data['text'])->toBe('unsent words');
});

it('[P17c-02d] keeps the View mode entry of the canvas menu on an unlocked board, and shows Unlock all elements to the facilitator only', function () {
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    [$mia] = whiteboardMember($board);
    p17cRenamed($mia, 'Mia Member');
    $viewMode = '.whiteboard-canvas .context-menu li[data-testid="viewMode"]';
    $unlockAll = '.whiteboard-canvas .context-menu li[data-testid="unlockAllElements"]';
    $unlockAllDisplay = "getComputedStyle(document.querySelector('{$unlockAll}')).display";

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17cBoardPath($board)));

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
    ['board' => $board, 'fran' => $fran] = p17cBoard();

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

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
    ['board' => $board, 'fran' => $fran] = p17cBoard();
    $lockEntry = '.whiteboard-canvas .context-menu li[data-testid="toggleElementLock"]';
    $lockEntryDisplay = "getComputedStyle(document.querySelector('{$lockEntry}')).display";
    $versions = "document.querySelector('[data-scene]').dataset.scene.split(':')[1]";

    $franPage = $this->awaitRealtime($this->signIn($fran, p17cBoardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17cJoinPath($board), 'Guest Gia'));

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
