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

/**
 * The facilitator's board of ScreenWhiteboard: five notes, three in a row above two. A marquee from (170, 30)
 * to (910, 290) on the canvas holds the first three; (540, 180) is the middle of the second.
 *
 * @return array{
 *     board: Whiteboard,
 *     fran: User
 * }
 */
function p20VisualBoard(): array
{
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator([
        'title' => 'Onboarding journey: pain points of the first week',
    ]);

    p18eVisualSticky($board, $franMember, 1, 200, 60, '#fdf1c2', '#ddc362');
    p18eVisualSticky($board, $franMember, 2, 440, 80, '#ffebe8', '#f9aea4');
    p18eVisualSticky($board, $franMember, 3, 680, 60, '#e2f3ff', '#8dccf9');
    p18eVisualSticky($board, $franMember, 4, 320, 320, '#efeeff', '#c3bbfb');
    p18eVisualSticky($board, $franMember, 5, 560, 340, '#e1f8dc', '#a5d39b');

    return ['board' => $board, 'fran' => $fran];
}

/**
 * @param  array<string, string>  $options
 */
function p20VisualSignIn(User $user, string $path, array $options): mixed
{
    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate($path);
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
            ->fill('#name', 'Nadia'),
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
                ->assertCount('[data-realtime]', 1)
                ->assertPresent('.whiteboard-canvas [data-slot="whiteboard-zoom-bar"]')
                ->assertPresent('.whiteboard-canvas [data-slot="whiteboard-minimap"]')
                ->assertNotPresent('.whiteboard-canvas [data-slot="canvas-tools"]')
                ->assertNotPresent('.whiteboard-canvas [data-slot="canvas-history"]')
                ->assertNotPresent('.whiteboard-canvas [data-slot="whiteboard-selection-bar"]');
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
        function (string $path, array $options, int $width) use ($fran, $entry, $surface) {
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

            // At the size of the capture before the menu opens: a resize moves the trigger of an open sub-menu away from the pointer, which closes it.
            $page->resize($width, $width === 390 ? 844 : 900);

            $this->openWhiteboardMenu($page, __('Board menu', [], $locale));

            if ($entry !== null) {
                $page->click('[role="menuitem"]:has-text("'.__($entry, [], $locale).'")');
            }

            return $page->assertPresent($surface);
        },
    );
})->with([
    'menu with the canvas background' => ['whiteboard-board-menu', 'Canvas background', '[role="menu"] [role="menuitemradio"]'],
    'save as template' => ['whiteboard-board-save-template', 'Save as template', '[role="dialog"] input[maxlength="80"]'],
    'hand over' => ['whiteboard-board-hand-over', 'Hand over facilitation', '[role="dialog"] #whiteboard-new-facilitator'],
    'delete' => ['whiteboard-board-delete', 'Delete this board', '[role="alertdialog"]'],
]);

it('[P18e-07-05] renders the export card of the canvas without overflow', function () {
    ['board' => $board, 'fran' => $fran] = p18eVisualBoard();

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'whiteboard-board-export',
        $this->whiteboardPath($board),
        function (string $path, array $options) use ($fran) {
            $locale = str_starts_with($options['locale'], 'fr') ? 'fr' : 'en';

            User::query()->whereKey($fran->id)->update(['locale' => $locale]);

            $page = $this->awaitRealtime(p20VisualSignIn($fran, $path, $options))
                ->assertPresent('[data-scene^="3:"]');

            return $page->click('header button[aria-label="'.__('Export', [], $locale).'"]')
                ->assertPresent('.ExportDialog--json [data-slot="scene-export"]');
        },
    );
});

it('[P20-18] renders the toolbars of the board to the facilitator without overflow', function (string $name, string $surface) {
    ['board' => $board, 'fran' => $fran] = p20VisualBoard();

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        $this->whiteboardPath($board),
        function (string $path, array $options, int $width) use ($fran, $name, $surface) {
            $locale = str_starts_with($options['locale'], 'fr') ? 'fr' : 'en';

            User::query()->whereKey($fran->id)->update(['locale' => $locale]);

            $page = $this->awaitRealtime(p20VisualSignIn($fran, $path, $options))
                ->assertPresent('[data-scene^="5:"]')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            $page->resize($width, $width === 390 ? 844 : 900);
            $page->assertPresent('.whiteboard-canvas [data-slot="canvas-tools"] [data-slot="whiteboard-toolbar"]');

            match ($name) {
                'whiteboard-toolbars', 'whiteboard-align-menu' => $this->dragOnWhiteboard($page, [170, 30], [910, 290]),
                'whiteboard-styles' => $this->dragOnWhiteboard($page, [540, 180], [540, 180], 1),
                'whiteboard-shape-tool' => $this->selectWhiteboardTool($page, 'rectangle'),
                'whiteboard-sticky-tool' => $page->click('[data-slot="canvas-tools"] [data-slot="whiteboard-toolbar"] button[aria-keyshortcuts="N"]'),
            };

            if ($name === 'whiteboard-styles') {
                $page->click('[data-slot="whiteboard-selection-bar"] [data-toolbar-item="styles"]')
                    ->assertAttribute('[data-slot="whiteboard-selection-bar"] [data-toolbar-item="styles"]', 'aria-pressed', 'true');
            }

            if ($name === 'whiteboard-align-menu') {
                $page->click('[data-slot="whiteboard-selection-bar"] [data-selection-item="align"]');
            }

            return $page->assertPresent($surface);
        },
    );
})->with([
    'tool bar, selection bar, history, zoom and minimap' => ['whiteboard-toolbars', '[data-slot="whiteboard-selection-count"]'],
    'sticky note tool' => ['whiteboard-sticky-tool', '[data-slot="canvas-tools"] [data-slot="whiteboard-sub-bar"] [data-slot="whiteboard-color-bar"]'],
    'shape tool' => ['whiteboard-shape-tool', '[data-slot="canvas-tools"] [data-slot="whiteboard-sub-bar"] [data-slot="whiteboard-color-bar"]'],
    'styles' => ['whiteboard-styles', '.whiteboard-canvas.skrum-whiteboard--styles .selected-shape-actions'],
    'align menu' => ['whiteboard-align-menu', '[role="menu"] [role="menuitem"]'],
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

            expect($page->script($cursorIsDrawn))->toBeTrue();

            return $page;
        },
    );
});
