<?php

namespace Tests\Browser\Support;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use InvalidArgumentException;
use RuntimeException;

trait InteractsWithWhiteboards
{
    /** The key of the board's tool (resources/js/lib/whiteboard/tools.ts) that draws each tool of the library. */
    private const array WhiteboardToolKeys = [
        'selection' => 'V',
        'hand' => 'H',
        'rectangle' => 'R',
        'diamond' => 'R',
        'ellipse' => 'R',
        'arrow' => 'C',
        'line' => 'C',
        'text' => 'T',
        'freedraw' => 'P',
        'eraser' => 'E',
        'frame' => 'F',
    ];

    /** The place of a kind among the radios of its sub-bar (resources/js/components/whiteboard/canvas-tools.tsx). */
    private const array WhiteboardToolKinds = [
        'rectangle' => 1,
        'diamond' => 2,
        'ellipse' => 3,
        'arrow' => 1,
        'line' => 2,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function whiteboardSnapshot(mixed $page, Whiteboard $board): array
    {
        return $this->snapshotOf($page, "/whiteboards/{$board->id}/snapshot");
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function whiteboardElements(mixed $page, Whiteboard $board): array
    {
        return $this->whiteboardSnapshot($page, $board)['elements'];
    }

    /**
     * Sends the request from inside the page with its session cookie and the XSRF token, without X-Socket-ID,
     * so the page that sends it receives the broadcast as well.
     *
     * @param  array<string, mixed>  $body
     * @return array{
     *     status: int,
     *     body: array<string, mixed>
     * }
     */
    protected function sendFromPage(mixed $page, string $method, string $path, array $body = []): array
    {
        $request = json_encode([
            'method' => $method,
            'path' => $path,
            'body' => $body === [] ? '{}' : json_encode($body, JSON_THROW_ON_ERROR),
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

    /**
     * @param  array<int, mixed>  $elements
     * @return array{
     *     status: int,
     *     body: array<string, mixed>
     * }
     */
    protected function writeWhiteboardElements(mixed $page, Whiteboard $board, array $elements): array
    {
        return $this->sendFromPage($page, 'PUT', "/whiteboards/{$board->id}/elements", ['elements' => $elements]);
    }

    protected function whiteboardPath(Whiteboard $board): string
    {
        return "/whiteboards/{$board->id}";
    }

    protected function whiteboardJoinPath(Whiteboard $board): string
    {
        return "/whiteboards/join/{$board->fresh()->guest_token}";
    }

    protected function openWhiteboardMenu(mixed $page, string $label = 'Board menu'): mixed
    {
        $page->assertNotPresent('[role="menu"]')
            ->click("[aria-label=\"{$label}\"]")
            ->assertPresent('[role="menu"]');

        return $page;
    }

    /**
     * Makes every XHR to a whiteboard path that ends with the suffix fail as a network error, so the board shows
     * "Reconnecting…" and keeps its edits; fetch() is unaffected. The count of refused requests is
     * window.whiteboardBlocked.refused.
     */
    protected function blockWhiteboardRequests(mixed $page, string $suffix = ''): void
    {
        $suffix = json_encode($suffix, JSON_THROW_ON_ERROR);

        $page->script(<<<JS
            () => {
                const open = XMLHttpRequest.prototype.open;
                const send = XMLHttpRequest.prototype.send;

                window.whiteboardBlocked = { active: true, refused: 0 };

                XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                    this.whiteboardPath = new URL(String(url), window.location.href).pathname;

                    return open.call(this, method, url, ...rest);
                };

                XMLHttpRequest.prototype.send = function (body) {
                    if (window.whiteboardBlocked.active && this.whiteboardPath.startsWith('/whiteboards/') && this.whiteboardPath.endsWith({$suffix})) {
                        window.whiteboardBlocked.refused += 1;
                        setTimeout(() => this.dispatchEvent(new ProgressEvent('error')), 0);

                        return undefined;
                    }

                    return send.call(this, body);
                };

                return true;
            }
            JS);
    }

    protected function unblockWhiteboardRequests(mixed $page): void
    {
        $page->script('() => { window.whiteboardBlocked.active = false; return true; }');
    }

    /**
     * A window for proving that nothing is written: long enough for the writes it rules out to have happened.
     * The windows depend on FlushDelayMs (300, resources/js/lib/whiteboard/scene-sync.ts), the delay before a
     * changed scene is sent, and on RepeatEveryMs (2000, resources/js/hooks/use-whiteboard-follow.ts), the
     * interval of the follower's repeated view whispers: 800 outlasts a flush, 2400 outlasts a repeat.
     */
    protected function settleWhiteboard(mixed $page, int $milliseconds = 800): void
    {
        for ($waited = 0; $waited < $milliseconds; $waited += 400) {
            $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 400))');
        }
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function addWhiteboardElement(mixed $page, Whiteboard $board, array $overrides = []): array
    {
        $element = sceneElement([
            'index' => $this->nextWhiteboardIndex($board),
            'seed' => random_int(1, 2_000_000_000),
            'versionNonce' => random_int(1, 2_000_000_000),
            ...$overrides,
        ]);

        $answer = $this->writeWhiteboardElements($page, $board, [$element]);
        $refusal = json_encode($answer['body']);

        throw_unless(
            $answer['status'] === 200 && ($answer['body']['rejected'] ?? null) === [],
            RuntimeException::class,
            "addWhiteboardElement() was refused with HTTP {$answer['status']}: {$refusal}",
        );

        return $element;
    }

    /**
     * Presses the sticky note tool (N), then a colour of its sub-bar, which adds a note in the middle of the view.
     */
    protected function addWhiteboardSticky(mixed $page, string $colour = 'Sun'): mixed
    {
        $tool = '[data-slot="canvas-tools"] [data-slot="whiteboard-toolbar"] button[aria-keyshortcuts="N"]';
        $swatch = strtolower($colour);

        $page->click($tool)
            ->assertAttribute($tool, 'aria-pressed', 'true')
            ->click("[data-slot=\"canvas-tools\"] [data-slot=\"whiteboard-sub-bar\"] [role=\"radio\"][data-color=\"{$swatch}\"]");

        return $page;
    }

    protected function awaitWhiteboardElements(mixed $page, int $count): mixed
    {
        $page->assertPresent("[data-scene^=\"{$count}:\"]");

        return $page;
    }

    protected function awaitWhiteboardStored(mixed $page, Whiteboard $board, int $count): mixed
    {
        $path = json_encode("/whiteboards/{$board->id}/snapshot", JSON_THROW_ON_ERROR);

        $page->assertScript("() => fetch({$path}, { headers: { Accept: 'application/json' } }).then((response) => response.json()).then((snapshot) => snapshot.elements.length)", $count);

        return $page;
    }

    /**
     * The server stamp is read again on every attempt: a canvas sends a drag or a stroke in several writes,
     * so the scene the server holds can still change after the first look.
     */
    protected function awaitWhiteboardScene(mixed $page, Whiteboard $board): mixed
    {
        $held = '';
        $stored = '';

        for ($attempt = 0; $attempt < 60; $attempt++) {
            $stored = $this->whiteboardSceneStamp($board);
            $held = (string) $page->script("() => document.querySelector('[data-scene]')?.dataset.scene ?? ''");

            if ($held === $stored) {
                return $page;
            }

            $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 250))');
        }

        expect($held)->toBe($stored, 'The canvas of this page does not hold the scene the server holds.');

        return $page;
    }

    protected function whiteboardSceneStamp(Whiteboard $board): string
    {
        $live = WhiteboardElement::query()
            ->where('whiteboard_id', $board->id)
            ->where('is_deleted', false)
            ->get(['version', 'version_nonce']);

        return "{$live->count()}:{$live->sum('version')}:{$live->sum('version_nonce')}";
    }

    /**
     * Presses a tool of the board's own tool bar by its key, in any language, then the kind in its sub-bar
     * (shapes and connectors), and checks both are on.
     *
     * @param  string  $tool  the library's tool: selection, hand, rectangle, diamond, ellipse, arrow, line, text, freedraw, eraser or frame
     */
    protected function selectWhiteboardTool(mixed $page, string $tool): mixed
    {
        throw_unless(array_key_exists($tool, self::WhiteboardToolKeys), InvalidArgumentException::class, "selectWhiteboardTool() does not know the tool `{$tool}`.");

        $key = self::WhiteboardToolKeys[$tool];
        $button = "[data-slot=\"canvas-tools\"] [data-slot=\"whiteboard-toolbar\"] button[aria-keyshortcuts=\"{$key}\"]";

        $page->click($button)
            ->assertAttribute($button, 'aria-pressed', 'true');

        if (! array_key_exists($tool, self::WhiteboardToolKinds)) {
            return $page;
        }

        $position = self::WhiteboardToolKinds[$tool];
        $kind = "[data-slot=\"canvas-tools\"] [data-slot=\"whiteboard-sub-bar\"] > [role=\"radiogroup\"]:first-child > [role=\"radio\"]:nth-child({$position})";

        $page->click($kind)
            ->assertAttribute($kind, 'aria-checked', 'true');

        return $page;
    }

    /**
     * Excalidraw captures the pointer on pointerdown, which throws for an event the browser did not create,
     * and it reads moves once per animation frame, so every event waits for a frame.
     *
     * @param  array{0: int|float, 1: int|float}  $from
     * @param  array{0: int|float, 1: int|float}  $to
     */
    protected function dragOnWhiteboard(mixed $page, array $from, array $to, int $steps = 8): mixed
    {
        $gesture = json_encode(['from' => $from, 'to' => $to, 'steps' => $steps], JSON_THROW_ON_ERROR);

        $page->script(<<<JS
            async () => {
                const gesture = {$gesture};
                const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
                const box = canvas.getBoundingClientRect();
                const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
                const fire = (type, point, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons,
                    pressure: buttons === 1 ? 0.5 : 0,
                    clientX: box.left + point[0],
                    clientY: box.top + point[1],
                }));

                canvas.setPointerCapture = () => {};
                canvas.releasePointerCapture = () => {};

                fire('pointerdown', gesture.from, 1);
                await frame();

                for (let step = 1; step <= gesture.steps; step += 1) {
                    fire('pointermove', [
                        gesture.from[0] + ((gesture.to[0] - gesture.from[0]) * step) / gesture.steps,
                        gesture.from[1] + ((gesture.to[1] - gesture.from[1]) * step) / gesture.steps,
                    ], 1);
                    await frame();
                }

                fire('pointerup', gesture.to, 0);
                await frame();

                return true;
            }
            JS);

        return $page;
    }

    /**
     * @param  array{0: int|float, 1: int|float}  $from
     * @param  array{0: int|float, 1: int|float}  $to
     */
    protected function drawOnWhiteboard(mixed $page, string $tool, array $from, array $to): mixed
    {
        $this->selectWhiteboardTool($page, $tool);

        return $this->dragOnWhiteboard($page, $from, $to);
    }

    /**
     * @param  array{0: int|float, 1: int|float}  $at
     */
    protected function doubleClickOnWhiteboard(mixed $page, array $at): mixed
    {
        $point = json_encode($at, JSON_THROW_ON_ERROR);

        $page->script(<<<JS
            () => {
                const point = {$point};
                const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
                const box = canvas.getBoundingClientRect();

                canvas.dispatchEvent(new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    detail: 2,
                    clientX: box.left + point[0],
                    clientY: box.top + point[1],
                }));

                return true;
            }
            JS);

        return $page;
    }

    /**
     * Two live elements with the same index are repaired by the first canvas that sees them, which rewrites one of them.
     */
    protected function nextWhiteboardIndex(Whiteboard $board): string
    {
        $position = WhiteboardElement::query()->where('whiteboard_id', $board->id)->count();

        throw_if($position > 61, InvalidArgumentException::class, 'addWhiteboardElement() can name 62 indexes; pass an "index" in the overrides.');

        return 'a'.'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[$position];
    }
}
