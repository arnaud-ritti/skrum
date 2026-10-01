<?php

namespace Tests\Browser\Support;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use InvalidArgumentException;
use RuntimeException;

trait InteractsWithWhiteboards
{
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
     * Sends the write from inside the page, without X-Socket-ID, so the page that sends it receives the broadcast as well.
     *
     * @param  array<int, mixed>  $elements
     * @return array{
     *     status: int,
     *     body: array<string, mixed>
     * }
     */
    protected function writeWhiteboardElements(mixed $page, Whiteboard $board, array $elements): array
    {
        $path = json_encode("/whiteboards/{$board->id}/elements", JSON_THROW_ON_ERROR);
        $body = json_encode(json_encode(['elements' => $elements], JSON_THROW_ON_ERROR), JSON_THROW_ON_ERROR);

        $answer = json_decode((string) $page->script(<<<JS
            async () => {
                const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
                const response = await fetch({$path}, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                    },
                    body: {$body},
                });

                return JSON.stringify({ status: response.status, body: await response.text() });
            }
            JS), true, flags: JSON_THROW_ON_ERROR);

        return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
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

    protected function addWhiteboardSticky(mixed $page, string $colour = 'Yellow'): mixed
    {
        $page->assertPresent('button[aria-label="Sticky note"]')
            ->click('button[aria-label="Sticky note"]')
            ->click("[aria-label=\"Add a sticky note: {$colour}\"]")
            ->assertNotPresent('[role="menu"]');

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

    protected function selectWhiteboardTool(mixed $page, string $tool): mixed
    {
        $page->click(".whiteboard-canvas .App-toolbar label:has([data-testid=\"toolbar-{$tool}\"])")
            ->assertScript("document.querySelector('.whiteboard-canvas [data-testid=\"toolbar-{$tool}\"]').checked", true);

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
     * Two live elements with the same index are repaired by the first canvas that sees them, which rewrites one of them.
     */
    protected function nextWhiteboardIndex(Whiteboard $board): string
    {
        $position = WhiteboardElement::query()->where('whiteboard_id', $board->id)->count();

        throw_if($position > 61, InvalidArgumentException::class, 'addWhiteboardElement() can name 62 indexes; pass an "index" in the overrides.');

        return 'a'.'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[$position];
    }
}
