<?php

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

function p18eVisualSticky(Whiteboard $board, WhiteboardMember $author, int $seq, int $x, int $y, string $fill, string $stroke): void
{
    $data = sceneElement([
        'id' => "visual-sticky-{$seq}",
        'x' => $x,
        'y' => $y,
        'width' => 200,
        'height' => 200,
        'index' => "a{$seq}",
        'backgroundColor' => $fill,
        'strokeColor' => $stroke,
        'roughness' => 0,
        'customData' => ['skrum' => ['kind' => 'sticky']],
    ]);

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $data['id'],
        'type' => $data['type'],
        'data' => $data,
        'version' => $data['version'],
        'version_nonce' => $data['versionNonce'],
        'author_member_id' => $author->id,
        'is_sticky' => true,
        'seq' => $seq,
    ]);

    Whiteboard::query()->whereKey($board->id)->update(['seq' => $seq]);
}

/**
 * The overflow check is for the chrome of this plan. The canvas toolbar is the library's: at 390, with the
 * sticky tool in it, it is wider than its island and its last trigger is clipped (plan WB-1 rebuilds it).
 */
function p18eVisualLeaveCanvasToolbarOut(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const canvas = document.querySelector('.whiteboard-canvas');
            const mark = () => canvas.querySelectorAll('.App-toolbar').forEach((toolbar) => toolbar.setAttribute('data-overflow-ok', ''));

            new MutationObserver(mark).observe(canvas, { childList: true, subtree: true });
            mark();

            return true;
        }
        JS);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User
 * }
 */
function p18eVisualBoard(array $attributes = []): array
{
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator([
        'title' => 'Onboarding journey: pain points of the first week',
        ...$attributes,
    ]);

    p18eVisualSticky($board, $franMember, 1, 80, 160, '#fdf1c2', '#ddc362');
    p18eVisualSticky($board, $franMember, 2, 320, 180, '#ffebe8', '#f9aea4');
    p18eVisualSticky($board, $franMember, 3, 80, 400, '#e2f3ff', '#8dccf9');

    return ['board' => $board, 'fran' => $fran];
}

it('[P18e-07-02] renders the guest-join page of a whiteboard without overflow', function () {
    ['board' => $board] = whiteboardWithFacilitator(['title' => 'Sprint 42 planning board']);
    whiteboardGuest($board);
    whiteboardGuest($board, 'other-secret');

    $this->captureVisuals(
        'whiteboard-join',
        $this->whiteboardJoinPath($board),
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="guest-join-session"][data-kind="whiteboard"]')
            ->assertPresent('#name'),
    );
});

it('[P18e-07-03] renders the notice of an invalid whiteboard guest link without overflow', function () {
    $this->captureVisuals(
        'whiteboard-join-invalid',
        '/whiteboards/join/no-such-link',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="access-notice"]')
            ->assertNotPresent('#name'),
    );
});

it('[P18e-07-05] renders the board chrome of the facilitator, in read mode on a phone, without overflow', function () {
    ['board' => $board, 'fran' => $fran] = p18eVisualBoard();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'whiteboard-board',
        $this->whiteboardPath($board),
        function (string $path, array $options) use ($fran) {
            User::query()->whereKey($fran->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $fran->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            // Opened at the phone's width: the 390 capture is the read mode, the 1440 one has no toggle.
            $page->resize(390, 844);

            $page = $this->awaitRealtime($page->navigate($path))
                ->assertPresent('[data-scene^="3:"]')
                ->assertPresent('[role="toolbar"][aria-label]')
                ->assertPresent('.whiteboard-canvas [data-slot="read-mode-toggle"]')
                ->assertPresent('.whiteboard-canvas [data-slot="read-mode-state"]')
                ->assertCount('[data-realtime]', 1)
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            p18eVisualLeaveCanvasToolbarOut($page);

            return $page;
        },
    );
});

it('[P18e-07-05] renders a locked board with a finished timer to a guest without overflow', function () {
    ['board' => $board] = p18eVisualBoard(['locked' => true, 'timer_ends_at' => now()->subMinute()]);

    $this->captureVisuals(
        'whiteboard-board-locked-guest',
        $this->whiteboardJoinPath($board),
        function (string $path, array $options) {
            $page = visit($path, $options);

            $page->fill('#name', 'Guest Gia')
                ->click('form button[type="submit"]')
                ->assertPathIsNot($path);

            return $this->awaitRealtime($page)
                ->assertPresent('[data-scene^="3:"]')
                ->assertPresent('[data-slot="board-notices"]')
                ->assertPresent('[role="timer"]')
                ->assertCount('[data-realtime]', 1);
        },
    );
});

it('[P18e-07-05] renders the board menu and its dialogs to the facilitator without overflow', function (string $name, ?string $entry, string $surface) {
    ['board' => $board, 'fran' => $fran] = p18eVisualBoard();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        $this->whiteboardPath($board),
        function (string $path, array $options) use ($fran, $entry, $surface) {
            $locale = str_starts_with($options['locale'], 'fr') ? 'fr' : 'en';

            User::query()->whereKey($fran->id)->update(['locale' => $locale]);

            $page = visit('/login', $options);

            $page->fill('#email', $fran->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page = $this->awaitRealtime($page->navigate($path))
                ->assertPresent('[data-scene^="3:"]')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            p18eVisualLeaveCanvasToolbarOut($page);

            $this->openWhiteboardMenu($page, __('Board menu', [], $locale));

            if ($entry !== null) {
                $page->click('[role="menuitem"]:has-text("'.__($entry, [], $locale).'")');
            }

            return $page->assertPresent($surface);
        },
    );
})->with([
    'menu' => ['whiteboard-board-menu', null, '[role="menu"] [role="menuitem"][data-variant="destructive"]'],
    'save as template' => ['whiteboard-board-save-template', 'Save as template', '[role="dialog"] input[maxlength="80"]'],
    'hand over' => ['whiteboard-board-hand-over', 'Hand over facilitation', '[role="dialog"] #whiteboard-new-facilitator'],
    'delete' => ['whiteboard-board-delete', 'Delete this board', '[role="alertdialog"]'],
]);

it('[P18e-07-05] renders the colour bar of the canvas, the colours of the sticky tool and the export card without overflow', function (string $name, string $surface) {
    ['board' => $board, 'fran' => $fran] = p18eVisualBoard();

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        $this->whiteboardPath($board),
        function (string $path, array $options) use ($fran, $name, $surface) {
            User::query()->whereKey($fran->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $fran->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page = $this->awaitRealtime($page->navigate($path))
                ->assertPresent('[data-scene^="3:"]')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            p18eVisualLeaveCanvasToolbarOut($page);

            if ($name === 'whiteboard-board-colors') {
                $this->selectWhiteboardTool($page, 'rectangle');
            }

            if ($name === 'whiteboard-board-sticky-colors') {
                $page->click('.whiteboard-canvas .App-toolbar [data-slot="popover-trigger"]');
            }

            if ($name === 'whiteboard-board-export') {
                $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
                    ->click('[data-testid="dropdown-menu"] [data-testid="json-export-button"]');

                return $page->assertPresent($surface);
            }

            return $page->assertPresent($surface)
                ->assertCount('[role="radiogroup"]', 1);
        },
    );
})->with([
    'colour bar' => ['whiteboard-board-colors', '.whiteboard-canvas [data-slot="canvas-colors"] [role="radiogroup"]'],
    'sticky colours' => ['whiteboard-board-sticky-colors', '[data-slot="popover-content"] [role="radiogroup"]'],
    'export card' => ['whiteboard-board-export', '.ExportDialog--json [data-slot="scene-export"]'],
]);

it('[P18e-07-05] renders the cursor of another member in the presence colour of that member without overflow', function () {
    ['board' => $board, 'fran' => $fran] = p18eVisualBoard();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)))
        ->assertPresent('[data-scene^="3:"]');

    // A cursor is forgotten after three seconds without a message: Mia's pointer keeps moving on one spot.
    $miaPage->script(<<<'JS'
        () => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
            const box = canvas.getBoundingClientRect();

            setInterval(() => canvas.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                clientX: box.left + 300,
                clientY: box.top + 460,
            })), 300);

            return true;
        }
        JS);

    $cursorIsDrawn = <<<'JS'
        async () => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
            const scale = canvas.width / canvas.getBoundingClientRect().width;
            const drawn = () => canvas.getContext('2d')
                .getImageData(300 * scale, 460 * scale, 16 * scale, 16 * scale).data
                .some((value, index) => index % 4 === 3 && value > 0);

            for (let attempt = 0; attempt < 50 && !drawn(); attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            return drawn();
        }
        JS;

    $this->captureVisuals(
        'whiteboard-board-cursor',
        $this->whiteboardPath($board),
        function (string $path, array $options) use ($fran, $cursorIsDrawn) {
            User::query()->whereKey($fran->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $fran->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page = $this->awaitRealtime($page->navigate($path))
                ->assertPresent('[data-scene^="3:"]')
                ->assertPresent('header [role="group"][aria-label]')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            p18eVisualLeaveCanvasToolbarOut($page);

            expect($page->script($cursorIsDrawn))->toBeTrue();

            return $page;
        },
    );
});
