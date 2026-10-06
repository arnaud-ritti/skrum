<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Tests\Browser\Support\DocsWorld;

const DocsWhiteboardColours = [
    'sun' => ['#fdf1c2', '#ddc362'],
    'coral' => ['#ffebe8', '#f9aea4'],
    'sky' => ['#e2f3ff', '#8dccf9'],
    'moss' => ['#e1f8dc', '#a5d39b'],
];

/**
 * @return list<array<string, mixed>>
 */
function docsWhiteboardNote(string $id, int $x, int $y, string $colour, string $text, ?string $frameId = null): array
{
    [$fill, $stroke] = DocsWhiteboardColours[$colour];
    $lines = explode("\n", $text);
    $width = (int) ceil(max(array_map(mb_strlen(...), $lines)) * 16 * BuiltInTemplates::CharacterWidth);
    $height = (int) ceil(count($lines) * 16 * 1.25);

    return [
        sceneElement([
            'id' => $id,
            'x' => $x,
            'y' => $y,
            'width' => 200,
            'height' => 200,
            'index' => null,
            'strokeColor' => $stroke,
            'backgroundColor' => $fill,
            'strokeWidth' => 1,
            'roughness' => 0,
            'roundness' => ['type' => 3],
            'frameId' => $frameId,
            'boundElements' => [['id' => "{$id}-text", 'type' => 'text']],
            'customData' => ['skrum' => ['kind' => 'sticky']],
        ]),
        sceneElement([
            'id' => "{$id}-text",
            'type' => 'text',
            'x' => $x + (200 - $width) / 2,
            'y' => $y + (200 - $height) / 2,
            'width' => $width,
            'height' => $height,
            'index' => null,
            'roughness' => 0,
            'frameId' => $frameId,
            'fontSize' => 16,
            'fontFamily' => 5,
            'textAlign' => 'center',
            'verticalAlign' => 'middle',
            'containerId' => $id,
            'autoResize' => true,
            'lineHeight' => 1.25,
            'text' => $text,
            'originalText' => $text,
        ]),
    ];
}

/**
 * @param  list<array<string, mixed>>  $elements
 */
function docsWhiteboardBoard(DocsWorld $world, User $facilitator, string $title, array $elements): Whiteboard
{
    return resolve(CreateWhiteboard::class)->handle($world->team, $facilitator, $title, ['elements' => $elements, 'files' => []]);
}

/**
 * @return list<array<string, mixed>>
 */
function docsWhiteboardBrainstorm(): array
{
    $frames = collect(resolve(BuiltInTemplates::class)->elements('brainstorm'))->where('type', 'frame')->keyBy('id');

    return [
        ...docsWhiteboardNote('the-question', 520, 40, 'sky', "How do we cut\nreview time\nin half?", 'question'),
        $frames['question'],
        ...docsWhiteboardNote('idea-slots', 40, 380, 'sun', "Review slots\nat 10 and 3", 'ideas'),
        ...docsWhiteboardNote('idea-pair', 280, 380, 'sun', "Pair on\nrisky changes", 'ideas'),
        ...docsWhiteboardNote('idea-checklist', 520, 380, 'sun', "A checklist in\nthe description", 'ideas'),
        ...docsWhiteboardNote('idea-rotate', 40, 620, 'sun', "Rotate the\nreviewer role", 'ideas'),
        ...docsWhiteboardNote('idea-draft', 280, 620, 'sun', "Open drafts\nearly", 'ideas'),
        $frames['ideas'],
        ...docsWhiteboardNote('pick-small', 940, 380, 'moss', "Smaller\npull requests", 'top-picks'),
        $frames['top-picks'],
    ];
}

/**
 * @return list<array<string, mixed>>
 */
function docsWhiteboardThreeNotes(): array
{
    return [
        ...docsWhiteboardNote('went-well', 460, 200, 'moss', "Releases went\nout on time"),
        ...docsWhiteboardNote('slowed-us', 700, 220, 'coral', "Flaky tests\non the pipeline"),
        ...docsWhiteboardNote('to-try', 940, 200, 'sky', "Quarantine a\nflaky test"),
    ];
}

function docsWhiteboardKeepPointerMoving(mixed $page, int $x, int $y): void
{
    $page->script(<<<JS
        () => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
            const box = canvas.getBoundingClientRect();

            setInterval(() => canvas.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                clientX: box.left + {$x},
                clientY: box.top + {$y},
            })), 300);

            return true;
        }
        JS);
}

function docsWhiteboardCursorIsDrawn(mixed $page, int $x, int $y): bool
{
    return (bool) $page->script(<<<JS
        async () => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
            const scale = canvas.width / canvas.getBoundingClientRect().width;
            const drawn = () => canvas.getContext('2d')
                .getImageData({$x} * scale, {$y} * scale, 16 * scale, 16 * scale).data
                .some((value, index) => index % 4 === 3 && value > 0);

            for (let attempt = 0; attempt < 50 && !drawn(); attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            return drawn();
        }
        JS);
}

it('shows a brainstorm board to its facilitator with two teammates on it, and its header', function () {
    $world = DocsWorld::create();
    $board = docsWhiteboardBoard($world, $world->person('Camille'), 'Faster code review', docsWhiteboardBrainstorm());
    $path = $this->whiteboardPath($board);

    WhiteboardMember::factory()->create([
        'id' => '0199d0c5-0000-7000-8000-0000000000a2',
        'whiteboard_id' => $board->id,
        'user_id' => $world->person('Théo')->id,
    ]);

    $this->awaitRealtime($this->docsVisit($world->person('Inès'), $path))->assertPresent('[data-scene^="17:"]');

    $theoPage = $this->awaitRealtime($this->docsVisit($world->person('Théo'), $path))->assertPresent('[data-scene^="17:"]');

    docsWhiteboardKeepPointerMoving($theoPage, 600, 700);

    $page = $this->awaitRealtime($this->docsVisit($world->person('Camille'), $path))
        ->assertPresent('[data-scene^="17:"]')
        ->assertPresent('header [role="group"][aria-label="3 online"]')
        ->assertPresent('.whiteboard-canvas [data-slot="canvas-tools"]')
        ->assertPresent('.whiteboard-canvas [data-slot="whiteboard-minimap"]')
        ->assertPresent('.whiteboard-canvas [data-slot="board-facilitation"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    expect(docsWhiteboardCursorIsDrawn($page, 600, 700))->toBeTrue();

    $page->click('[data-slot="whiteboard-zoom-bar"] [data-toolbar-item="fit"]')
        ->assertDontSeeIn('[data-slot="whiteboard-zoom-bar"] [data-zoom-percent]', '100 %')
        ->hover('[data-slot="session-synced"]');

    $this->docShot($page, 'whiteboard/board', '[data-scene]');
    $this->docShot($page, 'whiteboard/header', 'header');
});

it('shows the tool bar, the colours of the sticky note tool and the bar of a selection of three notes', function () {
    $world = DocsWorld::create();
    $board = docsWhiteboardBoard($world, $world->person('Camille'), 'Sprint 43 notes', docsWhiteboardThreeNotes());
    $tools = '.whiteboard-canvas [data-slot="canvas-tools"]';

    $page = $this->awaitRealtime($this->docsVisit($world->person('Camille'), $this->whiteboardPath($board)))
        ->assertPresent('[data-scene^="6:"]')
        ->assertPresent("{$tools} [data-slot=\"whiteboard-toolbar\"]");

    $this->docShot($page, 'whiteboard/toolbar', "{$tools} [data-slot=\"whiteboard-toolbar\"]");

    $page->click("{$tools} [data-slot=\"whiteboard-toolbar\"] button[aria-keyshortcuts=\"N\"]")
        ->assertPresent("{$tools} [data-slot=\"whiteboard-sub-bar\"] [data-slot=\"whiteboard-color-bar\"]")
        ->hover('[data-slot="session-synced"]');

    $this->docShot($page, 'whiteboard/sticky-note', $tools);

    $this->selectWhiteboardTool($page, 'selection');
    $this->dragOnWhiteboard($page, [430, 170], [1170, 450]);

    $page->assertSeeIn('[data-slot="whiteboard-selection-count"]', '3 elements')
        ->assertPresent('[data-slot="whiteboard-selection-bar"] [data-toolbar-item="lock"]')
        ->hover('[data-slot="session-synced"]');

    $this->docShot($page, 'whiteboard/selection-bar', '[data-slot="whiteboard-selection-bar"]');
});

it('shows the new whiteboard dialog with the built-in templates and one of the workspace', function () {
    $world = DocsWorld::create();
    $source = docsWhiteboardBoard($world, $world->person('Théo'), 'Incident review', docsWhiteboardThreeNotes());

    resolve(SaveWhiteboardTemplate::class)->handle($source, $world->person('Théo'), 'Incident review', 'What went well, what slowed us, what to try');

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false).'?new=whiteboard&template=brainstorm')
        ->assertPresent('[role="dialog"] [role="radio"][aria-checked="true"]:has(span:text-is("Brainstorm"))')
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertNotPresent('[role="dialog"] .animate-pulse')
        ->fill('#whiteboard-title', 'Faster code review')
        ->resize(1440, 1500);

    $this->docShot($page, 'whiteboard/template-picker', '[role="dialog"]');
});

it('shows the export dialog of a board with the preview of its image', function () {
    $world = DocsWorld::create();
    $board = docsWhiteboardBoard($world, $world->person('Camille'), 'Sprint 43 notes', docsWhiteboardThreeNotes());

    $page = $this->awaitRealtime($this->docsVisit($world->person('Camille'), $this->whiteboardPath($board)))
        ->assertPresent('[data-scene^="6:"]')
        ->click('[aria-label="Board menu"]')
        ->click('[role="menuitem"]:has-text("Export")')
        ->assertPresent('[data-slot="dialog-content"] [data-slot="export-preview"] img')
        ->assertNotPresent('[data-slot="dialog-content"] .animate-pulse');

    $this->docShot($page, 'whiteboard/export-dialog', '[data-slot="dialog-content"]');
});
