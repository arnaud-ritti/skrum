<?php

use App\Models\WhiteboardElement;

const R20Tools = '.whiteboard-canvas [data-slot="canvas-tools"] [role="toolbar"][aria-label="Tools"]';
const R20SubBar = '.whiteboard-canvas [data-slot="canvas-tools"] [data-slot="whiteboard-sub-bar"]';
const R20History = '.whiteboard-canvas [role="toolbar"][aria-label="History"]';
const R20Zoom = '.whiteboard-canvas [role="toolbar"][aria-label="Zoom"]';
const R20ZoomLabel = '.whiteboard-canvas [role="toolbar"][aria-label="Zoom"] [data-zoom-percent]';
const R20Minimap = '.whiteboard-canvas [data-slot="whiteboard-minimap"]';
const R20MinimapShape = '.whiteboard-canvas [data-slot="whiteboard-minimap"] [data-slot="whiteboard-minimap-shape"]';
const R20Selection = '.whiteboard-canvas [role="toolbar"][aria-label="Selection"]';
const R20SelectionCount = '.whiteboard-canvas [data-slot="whiteboard-selection-count"]';
const R20Container = '.whiteboard-canvas .excalidraw-container';

/** The visible tools of a bar, in their order, as "item:key". */
const R20ToolOrder = <<<'JS'
    (() => [...document.querySelectorAll('.whiteboard-canvas [data-slot="canvas-tools"] [role="toolbar"][aria-label="Tools"] [data-slot="whiteboard-tool"]')]
        .map((tool) => `${tool.dataset.toolbarItem ?? tool.getAttribute('aria-label')}:${tool.getAttribute('aria-keyshortcuts') ?? ''}`)
        .join('|'))()
    JS;

/** The library's own chrome that plan 20 hides: true when none of it is visible. */
const R20NativeChromeHidden = <<<'JS'
    (() => {
        const selectors = [
            '.App-toolbar-container',
            '.main-menu-trigger',
            '.layer-ui__wrapper__footer-right',
            '[data-testid="button-undo"]',
            '[data-testid="button-redo"]',
            '.zoom-actions',
        ];
        const shown = (element) => element.checkVisibility({ visibilityProperty: true, opacityProperty: true });

        return selectors.every((selector) => [...document.querySelectorAll(`.whiteboard-canvas ${selector}`)].every((element) => !shown(element)));
    })()
    JS;

function r20Box(mixed $page, string $selector): array
{
    $quoted = json_encode($selector, JSON_THROW_ON_ERROR);

    return json_decode((string) $page->script("() => { const box = document.querySelector({$quoted}).getBoundingClientRect(); const canvas = document.querySelector('.whiteboard-canvas').getBoundingClientRect(); return JSON.stringify({ left: box.left - canvas.left, top: box.top - canvas.top, right: canvas.right - box.right, bottom: canvas.bottom - box.bottom, width: box.width, height: box.height }); }"), true, flags: JSON_THROW_ON_ERROR);
}

function r20Focused(mixed $page): string
{
    return (string) $page->script("() => document.activeElement?.dataset.toolbarItem ?? document.activeElement?.getAttribute('aria-label') ?? ''");
}

it('[R20-01] replaces the library\'s chrome with the tool bar on the left, the history at the bottom left and the zoom bar with the minimap at the bottom right', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->assertPresent(R20Tools)
        ->assertAttribute(R20Tools, 'aria-orientation', 'vertical')
        ->assertScript(R20ToolOrder, 'select:V|hand:H|sticky:N|shape:R|connector:C|text:T|pen:P|eraser:E|frame:F|image:|More tools:')
        ->assertCount(R20Tools.' [data-slot="whiteboard-toolbar-separator"]', 2)
        ->assertAttribute(R20Tools.' [data-toolbar-item="select"]', 'aria-pressed', 'true')
        ->assertPresent(R20History)
        ->assertPresent(R20Zoom)
        ->assertSeeIn(R20ZoomLabel, '100 %')
        ->assertPresent(R20Minimap)
        ->assertScript(R20NativeChromeHidden, true);

    $tools = r20Box($page, R20Tools);
    $history = r20Box($page, R20History);
    $zoom = r20Box($page, R20Zoom);
    $minimap = r20Box($page, R20Minimap);

    expect($tools['left'])->toEqualWithDelta(16, 1)
        ->and($history['left'])->toEqualWithDelta(16, 1)
        ->and($history['bottom'])->toEqualWithDelta(16, 1)
        ->and($zoom['right'])->toEqualWithDelta(16, 1)
        ->and($zoom['bottom'])->toEqualWithDelta(16, 1)
        ->and($minimap['right'])->toEqualWithDelta(16, 1)
        ->and($minimap['bottom'])->toBeGreaterThan($zoom['bottom'] + $zoom['height'])
        ->and($minimap['width'])->toEqualWithDelta(180, 1)
        ->and($minimap['height'])->toEqualWithDelta(112, 1)
        ->and($tools['top'] + $tools['height'])->toBeLessThan($history['top']);
});

it('[R20-02] sets the library\'s tool from the bar, shows a tool the library chose itself, and moves through the bar with the arrow keys, Home and End', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $tool = fn (string $item): string => R20Tools." [data-toolbar-item=\"{$item}\"]";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->click($tool('pen'))
        ->assertAttribute($tool('pen'), 'aria-pressed', 'true')
        ->assertAttribute($tool('select'), 'aria-pressed', 'false')
        ->assertScript("document.querySelector('.whiteboard-canvas .excalidraw').classList.contains('excalidraw--view-mode')", false)
        ->click($tool('hand'))
        ->assertAttribute($tool('hand'), 'aria-pressed', 'true')
        ->assertAttribute($tool('pen'), 'aria-pressed', 'false');

    $page->keys(R20Container, 'r')
        ->assertAttribute($tool('shape'), 'aria-pressed', 'true')
        ->assertPresent(R20SubBar.'[aria-label="Shapes"]');

    $this->dragOnWhiteboard($page, [400, 300], [520, 380]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->assertNotPresent(R20SubBar);

    $page->script("() => document.querySelector('".R20Tools." [data-toolbar-item=\"select\"]').focus()");

    expect(r20Focused($page))->toBe('select');

    $page->keys($tool('select'), 'ArrowDown');

    expect(r20Focused($page))->toBe('hand');

    $page->keys($tool('hand'), 'End');

    expect(r20Focused($page))->toBe('More tools');

    $page->keys(R20Tools.' [aria-label="More tools"]', 'Home');

    expect(r20Focused($page))->toBe('select');

    $page->keys($tool('select'), 'ArrowUp');

    expect(r20Focused($page))->toBe('More tools');

    $page->assertAttribute(R20Tools.' [aria-label="More tools"]', 'tabindex', '0')
        ->assertAttribute($tool('select'), 'tabindex', '-1');
});

it('[R20-03] adds a sticky note where the pointer presses with the sticky tool, returns to the selection, and shows the note to a guest without a reload', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));
    $this->awaitWhiteboardElements($franPage, 0);
    $this->awaitWhiteboardElements($guestPage, 0);

    $franPage->click(R20Tools.' [data-toolbar-item="sticky"]')
        ->assertAttribute(R20Tools.' [data-toolbar-item="sticky"]', 'aria-pressed', 'true')
        ->assertPresent(R20SubBar.'[aria-label="Sticky note colours"]')
        ->assertCount(R20SubBar.' [role="radio"]', 8)
        ->click(R20SubBar.' [role="radio"][data-color="lagoon"]');

    $this->awaitWhiteboardStored($franPage, $board, 1);

    $franPage->assertAttribute(R20Tools.' [data-toolbar-item="select"]', 'aria-pressed', 'true')
        ->assertNotPresent(R20SubBar)
        ->click(R20Tools.' [data-toolbar-item="sticky"]')
        ->assertPresent(R20SubBar.' [role="radio"][data-color="lagoon"][aria-checked="true"]');

    $this->dragOnWhiteboard($franPage, [600, 340], [600, 340], 1);
    $this->awaitWhiteboardStored($franPage, $board, 2);
    $this->awaitWhiteboardScene($franPage, $board);

    $franPage->assertAttribute(R20Tools.' [data-toolbar-item="select"]', 'aria-pressed', 'true')
        ->assertPresent(R20Selection)
        ->assertSeeIn(R20SelectionCount, '1 element');

    $placed = WhiteboardElement::query()->where('whiteboard_id', $board->id)->latest('seq')->first();

    expect($placed->is_sticky)->toBeTrue()
        ->and($placed->data['customData']['skrum']['kind'])->toBe('sticky')
        ->and($placed->data['backgroundColor'])->toBe('#cefaf9')
        ->and($placed->data['x'])->toEqualWithDelta(600, 2)
        ->and($placed->data['y'])->toEqualWithDelta(340, 2);

    $this->awaitWhiteboardElements($guestPage, 2);
    $this->awaitWhiteboardScene($guestPage, $board);

    expect(collect($this->whiteboardElements($guestPage, $board))->pluck('id'))->toContain($placed->element_id);
});

it('[R20-04] offers the kinds of shape with the eight fills and the kinds of connector, draws the chosen kind and keeps the last choice for the page', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $kinds = fn (string $group): string => R20SubBar." [role=\"radiogroup\"][aria-label=\"{$group}\"] [role=\"radio\"]";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->click(R20Tools.' [data-toolbar-item="shape"]')
        ->assertPresent(R20SubBar.'[aria-label="Shapes"]')
        ->assertScript("[...document.querySelectorAll('".R20SubBar." [role=\"radiogroup\"][aria-label=\"Shape\"] [role=\"radio\"]')].map((kind) => kind.getAttribute('aria-label')).join('|')", 'Rectangle|Diamond|Ellipse')
        ->assertAttribute($kinds('Shape').'[aria-label="Rectangle"]', 'aria-checked', 'true')
        ->assertCount(R20SubBar.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"]', 8)
        ->click($kinds('Shape').'[aria-label="Ellipse"]')
        ->assertAttribute($kinds('Shape').'[aria-label="Ellipse"]', 'aria-checked', 'true')
        ->click(R20SubBar.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"][data-color="iris"]');

    $this->dragOnWhiteboard($page, [400, 300], [540, 400]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->click(R20Tools.' [data-toolbar-item="connector"]')
        ->assertPresent(R20SubBar.'[aria-label="Connectors"]')
        ->assertScript("[...document.querySelectorAll('".R20SubBar." [role=\"radiogroup\"][aria-label=\"Connector\"] [role=\"radio\"]')].map((kind) => kind.getAttribute('aria-label')).join('|')", 'Arrow|Line')
        ->assertAttribute($kinds('Connector').'[aria-label="Arrow"]', 'aria-checked', 'true')
        ->assertNotPresent(R20SubBar.' [role="radiogroup"][aria-label="Fill colour"]')
        ->click($kinds('Connector').'[aria-label="Line"]');

    $this->dragOnWhiteboard($page, [700, 300], [860, 420]);
    $this->awaitWhiteboardStored($page, $board, 2);

    $page->click(R20Tools.' [data-toolbar-item="shape"]')
        ->assertAttribute($kinds('Shape').'[aria-label="Ellipse"]', 'aria-checked', 'true')
        ->click(R20Tools.' [data-toolbar-item="connector"]')
        ->assertAttribute($kinds('Connector').'[aria-label="Line"]', 'aria-checked', 'true');

    $this->awaitWhiteboardScene($page, $board);

    $elements = WhiteboardElement::query()->where('whiteboard_id', $board->id)->orderBy('seq')->get();

    expect($elements->pluck('type')->all())->toBe(['ellipse', 'line'])
        ->and($elements[0]->data['backgroundColor'])->toBe('#efeeff');
});

it('[R20-05] undoes and redoes the member\'s own drawing from the history bar, which is disabled while there is nothing to undo or redo', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $undo = R20History.' button[aria-label="Undo"]';
    $redo = R20History.' button[aria-label="Redo"]';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->assertPresent("{$undo}:disabled")
        ->assertPresent("{$redo}:disabled");

    $this->drawOnWhiteboard($page, 'rectangle', [400, 300], [560, 420]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->assertPresent("{$undo}:enabled")
        ->assertPresent("{$redo}:disabled")
        ->click($undo);

    $this->awaitWhiteboardStored($page, $board, 0);

    $page->assertPresent("{$redo}:enabled")
        ->click($redo);

    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    $page->assertPresent("{$redo}:disabled")
        ->assertPresent("{$undo}:enabled");

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->is_deleted)->toBeFalse();
});

it('[R20-06] zooms by steps of ten per cent from the zoom bar, stops at ten per cent, resets to one hundred and fits every element in the view', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $zoomIn = R20Zoom.' button[aria-label="Zoom in"]';
    $zoomOut = R20Zoom.' button[aria-label="Zoom out"]';
    $viewHoldsEveryShape = <<<'JS'
        (() => {
            const view = document.querySelector('.whiteboard-canvas [data-slot="whiteboard-minimap-view"]').getBoundingClientRect();
            const shapes = [...document.querySelectorAll('.whiteboard-canvas [data-slot="whiteboard-minimap-shape"]')].map((shape) => shape.getBoundingClientRect());

            return shapes.length === 2 && shapes.every((shape) => shape.left >= view.left - 1 && shape.right <= view.right + 1 && shape.top >= view.top - 1 && shape.bottom <= view.bottom + 1);
        })()
        JS;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->click($zoomIn)
        ->assertSeeIn(R20ZoomLabel, '110 %')
        ->click($zoomIn)
        ->assertSeeIn(R20ZoomLabel, '120 %')
        ->click(R20ZoomLabel)
        ->assertSeeIn(R20ZoomLabel, '100 %');

    foreach (range(90, 10, 10) as $percent) {
        $page->click($zoomOut)
            ->assertSeeIn(R20ZoomLabel, "{$percent} %");
    }

    $page->assertPresent("{$zoomOut}:disabled")
        ->assertPresent("{$zoomIn}:enabled")
        ->click(R20ZoomLabel)
        ->assertSeeIn(R20ZoomLabel, '100 %');

    $this->addWhiteboardElement($page, $board, ['x' => 200, 'y' => 200]);
    $this->addWhiteboardElement($page, $board, ['x' => 3200, 'y' => 2400]);
    $this->awaitWhiteboardElements($page, 2);

    $page->assertScript($viewHoldsEveryShape, false)
        ->click(R20Zoom.' button[aria-label="Fit to screen"]')
        ->assertScript($viewHoldsEveryShape, true)
        ->assertDontSeeIn(R20ZoomLabel, '100 %');
});

it('[R20-07] draws every element on the minimap in its colour, follows a guest\'s new note live, centres the view where it is pressed and remembers when it is closed', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $toggle = R20Zoom.' button[aria-label="Minimap"]';
    $coloured = "[...document.querySelectorAll('".R20MinimapShape."')].filter((shape) => parseFloat(getComputedStyle(shape).borderTopWidth) > 0).length";
    $viewCentreOffset = <<<'JS'
        (() => {
            const map = document.querySelector('.whiteboard-canvas [data-slot="whiteboard-minimap"]').getBoundingClientRect();
            const view = document.querySelector('.whiteboard-canvas [data-slot="whiteboard-minimap-view"]').getBoundingClientRect();

            return Math.round(Math.hypot(view.left + view.width / 2 - (map.left + map.width / 2), view.top + view.height / 2 - (map.top + map.height / 2)));
        })()
        JS;

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));
    $this->awaitWhiteboardElements($franPage, 0);

    $franPage->assertPresent(R20Minimap.' [role="img"][aria-label="Minimap"]')
        ->assertAttribute($toggle, 'aria-pressed', 'true')
        ->assertCount(R20MinimapShape, 0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 100, 'y' => 100]);
    $this->addWhiteboardElement($franPage, $board, ['x' => 4000, 'y' => 3000, 'backgroundColor' => '#e1f8dc', 'strokeColor' => '#a5d39b']);
    $this->awaitWhiteboardElements($franPage, 2);

    $franPage->assertCount(R20MinimapShape, 2)
        ->assertScript($coloured, 1);

    $this->awaitWhiteboardElements($guestPage, 2);
    $this->addWhiteboardSticky($guestPage, 'Plum');
    $this->awaitWhiteboardElements($franPage, 3);

    $franPage->assertCount(R20MinimapShape, 3)
        ->assertScript($coloured, 2);

    $franPage->assertScript("{$viewCentreOffset} > 20", true)
        ->click(R20Minimap.' [role="img"]')
        ->assertScript("{$viewCentreOffset} < 4", true);

    $viewLeft = (float) $franPage->script("() => document.querySelector('.whiteboard-canvas [data-slot=whiteboard-minimap-view]').getBoundingClientRect().left");

    $franPage->keys(R20Minimap.' button[aria-label="Move the view"]', 'ArrowRight')
        ->assertScript("document.querySelector('.whiteboard-canvas [data-slot=whiteboard-minimap-view]').getBoundingClientRect().left > {$viewLeft} + 2", true);

    $franPage->click($toggle)
        ->assertAttribute($toggle, 'aria-pressed', 'false')
        ->assertNotPresent(R20Minimap);

    $franPage = $this->awaitRealtime($franPage->navigate($this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($franPage, 3);

    $franPage->assertAttribute($toggle, 'aria-pressed', 'false')
        ->assertNotPresent(R20Minimap)
        ->keys(R20Container, 'm')
        ->assertPresent(R20Minimap)
        ->assertAttribute($toggle, 'aria-pressed', 'true');
});

it('[R20-08] shows the selection bar and the element count under a selection, groups, aligns and deletes from it, offers colours only for filled elements and goes away on deselect', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $fill = R20Selection.' [role="radiogroup"][aria-label="Fill colour"]';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $first = $this->addWhiteboardElement($page, $board, ['x' => 400, 'y' => 300]);
    $second = $this->addWhiteboardElement($page, $board, ['x' => 560, 'y' => 420]);
    $this->awaitWhiteboardElements($page, 2);

    $page->assertNotPresent(R20Selection);

    $this->dragOnWhiteboard($page, [360, 260], [720, 520]);

    $page->assertPresent(R20Selection)
        ->assertSeeIn(R20SelectionCount, '2 elements')
        ->assertPresent($fill)
        ->assertPresent(R20Selection.' button[aria-label="Group"]')
        ->assertPresent(R20Selection.' button[aria-label="Lock"]')
        ->assertPresent(R20Selection.' button[aria-label="Styles"]')
        ->assertPresent(R20Selection.' button[aria-label="Delete"]');

    $bar = r20Box($page, R20Selection);
    $chip = r20Box($page, R20SelectionCount);

    expect($bar['top'])->toBeGreaterThan(470)
        ->and($chip['top'])->toBeLessThan(300)
        ->and($chip['left'])->toEqualWithDelta(400, 12);

    $page->click(R20Selection.' button[aria-label="Group"]')
        ->assertPresent(R20Selection.' button[aria-label="Ungroup"]');

    $this->awaitWhiteboardScene($page, $board);

    $groups = WhiteboardElement::query()->where('whiteboard_id', $board->id)->get()->map(fn (WhiteboardElement $element): array => $element->data['groupIds']);

    expect($groups[0])->toHaveCount(1)
        ->and($groups[1])->toBe($groups[0]);

    $page->click(R20Selection.' button[aria-label="Ungroup"]')
        ->assertPresent(R20Selection.' button[aria-label="Group"]');

    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->get()->every(fn (WhiteboardElement $element): bool => $element->data['groupIds'] === []))->toBeTrue();

    $page->click(R20Selection.' button[aria-label="Align"]')
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Distribute horizontally")[data-disabled]')
        ->click('[role="menu"] [role="menuitem"]:has-text("Align left")');

    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->get()->map(fn (WhiteboardElement $element): float => (float) $element->data['x'])->unique()->values()->all())->toBe([400.0]);

    $this->dragOnWhiteboard($page, [1000, 700], [1000, 700], 1);

    $page->assertNotPresent(R20Selection)
        ->assertNotPresent(R20SelectionCount);

    $this->addWhiteboardSticky($page, 'Sky');
    $this->awaitWhiteboardStored($page, $board, 3);

    $page->assertSeeIn(R20SelectionCount, '1 element')
        ->assertPresent("{$fill} [role=\"radio\"][data-color=\"sky\"][aria-checked=\"true\"]")
        ->assertNotPresent(R20Selection.' button[aria-label="Group"]')
        ->click(R20Selection.' button[aria-label="Delete"]')
        ->assertNotPresent(R20Selection);

    $this->awaitWhiteboardStored($page, $board, 2);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', true)->sole()->is_sticky)->toBeTrue();

    $this->drawOnWhiteboard($page, 'line', [800, 300], [960, 380]);
    $this->awaitWhiteboardStored($page, $board, 3);

    $page->assertPresent(R20Selection)
        ->assertSeeIn(R20SelectionCount, '1 element')
        ->assertNotPresent($fill)
        ->assertPresent(R20Selection.' button[aria-label="Delete"]');

    expect(collect([$first['id'], $second['id']])->diff(WhiteboardElement::query()->where('whiteboard_id', $board->id)->pluck('element_id')))->toBeEmpty();
});

it('[R20-09] shows Lock to the facilitator only, stores the lock, and disables the colours and Delete with the reason for a member whose selection the facilitator locks', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');
    $reason = 'Only the facilitator can change a locked element.';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($franPage, 0);

    $shape = $this->addWhiteboardElement($franPage, $board, ['x' => 400, 'y' => 300, 'width' => 160, 'height' => 100, 'backgroundColor' => '#fdf1c2', 'strokeColor' => '#ddc362']);
    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($miaPage, 1);

    $this->dragOnWhiteboard($miaPage, [480, 350], [480, 350], 1);

    $miaPage->assertPresent(R20Selection)
        ->assertNotPresent(R20Selection.' button[aria-label="Lock"]')
        ->assertPresent(R20Selection.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"]:enabled')
        ->assertPresent(R20Selection.' button[aria-label="Delete"]:enabled');

    $this->dragOnWhiteboard($franPage, [480, 350], [480, 350], 1);

    $franPage->assertPresent(R20Selection.' button[aria-label="Lock"][aria-pressed="false"]')
        ->click(R20Selection.' button[aria-label="Lock"]')
        ->assertPresent(R20Selection.' button[aria-label="Unlock"][aria-pressed="true"]');

    $this->awaitWhiteboardScene($franPage, $board);

    expect(WhiteboardElement::query()->where('element_id', $shape['id'])->sole()->data['locked'])->toBeTrue();

    $this->awaitWhiteboardScene($miaPage, $board);

    $miaPage->assertPresent(R20Selection.' button[aria-label="Delete"]:disabled')
        ->assertPresent(R20Selection.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"]:disabled')
        ->assertScript("document.getElementById(document.querySelector('".R20Selection." button[aria-label=\"Delete\"]').getAttribute('aria-describedby')).textContent", $reason)
        ->assertScript("document.getElementById(document.querySelector('".R20Selection." [role=\"radiogroup\"][aria-label=\"Fill colour\"]').getAttribute('aria-describedby')).textContent", $reason)
        ->assertNotPresent(R20Selection.' button[aria-label="Unlock"]');

    $franPage->click(R20Selection.' button[aria-label="Unlock"]')
        ->assertPresent(R20Selection.' button[aria-label="Lock"]');

    $this->awaitWhiteboardScene($franPage, $board);

    expect(WhiteboardElement::query()->where('element_id', $shape['id'])->sole()->data['locked'])->toBeFalse();
});

it('[R20-10] shows the library\'s property panel beside the tool bar under Styles, stores what it changes and hides it again', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $panel = '.whiteboard-canvas .excalidraw .selected-shape-actions';
    $panelShown = "getComputedStyle(document.querySelector('{$panel}')).visibility === 'visible'";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $this->drawOnWhiteboard($page, 'rectangle', [400, 300], [560, 420]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->assertAttribute(R20Selection.' button[aria-label="Styles"]', 'aria-pressed', 'false')
        ->assertScript($panelShown, false)
        ->click(R20Selection.' button[aria-label="Styles"]')
        ->assertAttribute(R20Selection.' button[aria-label="Styles"]', 'aria-pressed', 'true')
        ->assertScript($panelShown, true);

    expect(r20Box($page, $panel)['left'])->toBeGreaterThan(r20Box($page, R20Tools)['left'] + r20Box($page, R20Tools)['width']);

    $page->click("{$panel} label:has([data-testid=\"strokeWidth-extraBold\"])")
        ->click("{$panel} [data-testid=\"fill-cross-hatch\"]");

    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data)
        ->toMatchArray(['strokeWidth' => 4, 'fillStyle' => 'cross-hatch']);

    $page->click(R20Selection.' button[aria-label="Styles"]')
        ->assertAttribute(R20Selection.' button[aria-label="Styles"]', 'aria-pressed', 'false')
        ->assertScript($panelShown, false);
});

it('[R20-11] finds on the canvas, clears the canvas after the confirmation and changes the canvas background from the board menu', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $backgroundPixel = <<<'JS'
        (() => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.static');
            const pixel = canvas.getContext('2d').getImageData(canvas.width - 40, 40, 1, 1).data;

            return '#' + [...pixel].slice(0, 3).map((value) => value.toString(16).padStart(2, '0')).join('');
        })()
        JS;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $this->addWhiteboardElement($page, $board, ['x' => 400, 'y' => 300]);
    $this->addWhiteboardElement($page, $board, ['x' => 600, 'y' => 300]);
    $this->awaitWhiteboardElements($page, 2);

    $page->assertScript($backgroundPixel, '#f8f5f1');

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Find on canvas")')
        ->assertPresent('.whiteboard-canvas .layer-ui__search input')
        ->assertScript("document.activeElement === document.querySelector('.whiteboard-canvas .layer-ui__search input')", true)
        ->keys('.whiteboard-canvas .layer-ui__search input', 'Escape')
        ->assertNotPresent('.whiteboard-canvas .layer-ui__search');

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Canvas background")')
        ->assertAttribute('[role="menuitemradio"]:has-text("Paper")', 'aria-checked', 'true')
        ->click('[role="menuitemradio"]:has-text("Light blue")')
        ->assertNotPresent('[role="menu"]')
        ->assertScript($backgroundPixel, '#f5faff');

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Canvas background")')
        ->assertAttribute('[role="menuitemradio"]:has-text("Light blue")', 'aria-checked', 'true')
        ->click('[role="menuitemradio"]:has-text("Light blue")')
        ->assertNotPresent('[role="menu"]');

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Clear canvas")')
        ->assertPresent('[role="dialog"]:has-text("This will clear the whole canvas.")')
        ->click('[role="dialog"] button[aria-label="Confirm"]')
        ->assertNotPresent('[role="dialog"]:has-text("This will clear the whole canvas.")');

    $this->awaitWhiteboardStored($page, $board, 0);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(0);
});

it('[R20-12] leaves only the zoom bar and the minimap to a member when the facilitator locks the board, and gives the tools back on unlock', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($miaPage, 0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 400, 'y' => 300, 'backgroundColor' => '#fdf1c2']);
    $this->awaitWhiteboardElements($miaPage, 1);
    $this->dragOnWhiteboard($miaPage, [450, 325], [450, 325], 1);

    $miaPage->assertPresent(R20Tools)
        ->assertPresent(R20History)
        ->assertPresent(R20Selection);

    $franPage->click('header [aria-label="Lock the board"]')
        ->assertPresent('header [aria-label="Unlock the board"]');

    $miaPage->assertPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertNotPresent(R20Tools)
        ->assertNotPresent(R20History)
        ->assertNotPresent(R20Selection)
        ->assertNotPresent(R20SelectionCount)
        ->assertPresent(R20Zoom)
        ->assertPresent(R20Minimap)
        ->click(R20Zoom.' button[aria-label="Zoom in"]')
        ->assertSeeIn(R20ZoomLabel, '110 %');

    $franPage->assertPresent(R20Tools)
        ->assertPresent(R20History)
        ->click('header [aria-label="Unlock the board"]');

    $miaPage->assertNotPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertPresent(R20Tools)
        ->assertPresent(R20History);
});

it('[R20-13] pauses a guest who follows the facilitator when the guest moves the view with the minimap, and brings the guest back on Resume', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $paused = 'div[role="status"]:has-text("Following paused")';
    $following = 'div[role="status"]:has-text("Following the facilitator")';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->addWhiteboardElement($franPage, $board, ['x' => 100, 'y' => 100]);
    $this->addWhiteboardElement($franPage, $board, ['x' => 4000, 'y' => 3000]);
    $this->awaitWhiteboardElements($guestPage, 2);

    $franPage->click('[aria-label="Bring everyone to me"]')
        ->assertPresent('div[role="status"]:has-text("Everyone follows your view.")');

    $guestPage->assertPresent($following)
        ->click(R20Minimap.' [role="img"]')
        ->assertPresent($paused)
        ->assertNotPresent($following);

    $this->settleWhiteboard($guestPage, 2400);

    $guestPage->assertPresent($paused)
        ->click('div[role="status"] button:text-is("Resume")')
        ->assertPresent($following)
        ->assertNotPresent($paused);
});

it('[R20-14] docks Fit to screen and Edit in read mode on a phone, then a compact bar of Selection, Sticky note, Pencil and More tools whose drawer holds the other phone tools, without zoom bar, minimap, connector or frame', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $dock = '.whiteboard-canvas [data-slot="read-mode-dock"]';
    $phoneTools = '.whiteboard-canvas [data-slot="phone-toolbar"] [role="toolbar"][aria-label="Tools"]';
    $drawer = '[role="dialog"]:has([data-slot="phone-drawer-tools"])';
    $scrollBack = '.whiteboard-canvas .scroll-back-to-content';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);
    $this->addWhiteboardElement($page, $board, ['x' => 3000, 'y' => 2600, 'backgroundColor' => '#fdf1c2']);

    $page->resize(390, 844);

    $page = $this->awaitRealtime($page->navigate($this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 1);

    $page->assertSeeIn('.whiteboard-canvas [data-slot="read-mode-state"]', 'Reading')
        ->assertPresent("{$dock} button[aria-label=\"Fit to screen\"]")
        ->assertSeeIn("{$dock} [data-slot=\"read-mode-toggle\"]", 'Edit')
        ->assertNotPresent(R20Zoom)
        ->assertNotPresent(R20Minimap)
        ->assertNotPresent(R20History)
        ->assertNotPresent($phoneTools)
        ->assertPresent($scrollBack)
        ->click("{$dock} button[aria-label=\"Fit to screen\"]")
        ->assertNotPresent($scrollBack)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->click("{$dock} [data-slot=\"read-mode-toggle\"]")
        ->assertPresent($phoneTools)
        ->assertAttribute($phoneTools, 'aria-orientation', 'horizontal')
        ->assertScript("[...document.querySelectorAll('{$phoneTools} [data-slot=\"whiteboard-tool\"]')].map((tool) => tool.getAttribute('aria-label')).join('|')", 'Selection|Sticky note|Pencil|More tools')
        ->assertNotPresent(R20Zoom)
        ->assertNotPresent(R20Minimap)
        ->assertNotPresent(R20History)
        ->assertNotPresent(R20Tools)
        ->click("{$phoneTools} button[aria-label=\"More tools\"]")
        ->assertPresent($drawer)
        ->assertScript("[...document.querySelectorAll('[data-slot=\"phone-drawer-tools\"] button')].map((tool) => tool.textContent.trim()).join('|')", 'Hand|Shape|Text|Eraser|Image|Undo|Redo|Fit to screen')
        ->assertPresent('[data-slot="phone-drawer-tools"] button:has-text("Undo"):disabled')
        ->click('[data-slot="phone-drawer-tools"] button:has-text("Shape")')
        ->assertNotPresent($drawer)
        ->assertAttribute("{$phoneTools} button[aria-label=\"More tools\"]", 'aria-expanded', 'false')
        ->assertPresent('.whiteboard-canvas [data-slot="phone-sub-bar"] [role="toolbar"][aria-label="Shapes"]')
        ->click("{$phoneTools} [data-toolbar-item=\"pen\"]")
        ->assertAttribute("{$phoneTools} [data-toolbar-item=\"pen\"]", 'aria-pressed', 'true')
        ->assertNotPresent('.whiteboard-canvas [data-slot="phone-sub-bar"]');

    $this->dragOnWhiteboard($page, [120, 300], [260, 420]);
    $this->awaitWhiteboardStored($page, $board, 2);

    $page->click("{$phoneTools} button[aria-label=\"More tools\"]")
        ->assertPresent('[data-slot="phone-drawer-tools"] button:has-text("Undo"):enabled')
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->latest('seq')->first()->type)->toBe('freedraw');
});

it('[R20-15] answers N, C and M on the canvas and in the tool bar, never in a field, and none of the single-character keys once the guest turns single-key shortcuts off', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $tool = fn (string $item): string => R20Tools." [data-toolbar-item=\"{$item}\"]";
    $toggle = R20Zoom.' button[aria-label="Minimap"]';
    $search = '[data-slot="keyboard-shortcuts"] input[aria-label="Search shortcuts"]';

    $page = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));
    $this->awaitWhiteboardElements($page, 0);

    $page->keys(R20Container, 'n')
        ->assertAttribute($tool('sticky'), 'aria-pressed', 'true')
        ->keys(R20Container, 'c')
        ->assertAttribute($tool('connector'), 'aria-pressed', 'true')
        ->keys(R20Container, 'm')
        ->assertNotPresent(R20Minimap)
        ->assertAttribute($toggle, 'aria-pressed', 'false')
        ->keys($tool('connector'), 'n')
        ->assertAttribute($tool('sticky'), 'aria-pressed', 'true')
        ->keys($tool('sticky'), 'v')
        ->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->keys($toggle, 'm')
        ->assertPresent(R20Minimap)
        ->click('header button[aria-label="Keyboard shortcuts"]')
        ->assertPresent($search)
        ->keys($search, 'n')
        ->keys($search, 'c')
        ->assertValue($search, 'nc')
        ->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->assertAriaAttribute('[data-slot="single-key-switch"]', 'checked', 'true')
        ->click('[data-slot="single-key-switch"]')
        ->assertAriaAttribute('[data-slot="single-key-switch"]', 'checked', 'false')
        ->keys($search, 'Escape')
        ->assertNotPresent('[data-slot="keyboard-shortcuts"]');

    $page->keys(R20Container, 'n')
        ->keys(R20Container, 'r')
        ->keys(R20Container, 'm');

    $this->settleWhiteboard($page, 400);

    $page->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->assertAttribute($tool('sticky'), 'aria-pressed', 'false')
        ->assertAttribute($tool('shape'), 'aria-pressed', 'false')
        ->assertPresent(R20Minimap)
        ->click($tool('text'));

    $this->dragOnWhiteboard($page, [500, 400], [500, 400], 1);

    $page->assertPresent('.whiteboard-canvas textarea.excalidraw-wysiwyg')
        ->typeSlowly('.whiteboard-canvas textarea.excalidraw-wysiwyg', 'nrm')
        ->keys('.whiteboard-canvas textarea.excalidraw-wysiwyg', 'Escape')
        ->assertNotPresent('.whiteboard-canvas textarea.excalidraw-wysiwyg');

    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data)->toMatchArray(['type' => 'text', 'text' => 'nrm']);

    $page = $this->awaitRealtime($page->navigate($this->whiteboardPath($board)));

    $page->keys(R20Container, 'n');
    $this->settleWhiteboard($page, 400);

    $page->assertAttribute($tool('sticky'), 'aria-pressed', 'false');
});

it('[R20-16] lists the board\'s keys as built in the Whiteboard section of the keyboard shortcuts dialog', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $section = '[data-slot="keyboard-shortcuts-section"][aria-label="Whiteboard"]';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $page->click('header button[aria-label="Keyboard shortcuts"]')
        ->assertPresent($section)
        ->assertScript("[...document.querySelectorAll('{$section} [data-slot=\"keyboard-shortcuts-row\"]')].map((row) => row.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 10).join('|')", 'Selection V|Hand H|Sticky note N|Shape R|Connector C|Text T|Pencil P|Eraser E|Frame F|Minimap M')
        ->assertDontSeeIn($section, 'The whiteboard uses the shortcuts of its own toolbar.');
});

it('[R20-17] draws the bars, the minimap and the canvas of the board in the dark theme without a horizontal scroll', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $luminance = <<<'JS'
        (selector) => {
            const context = document.createElement('canvas').getContext('2d');

            context.fillStyle = getComputedStyle(document.querySelector(selector)).backgroundColor;
            context.fillRect(0, 0, 1, 1);

            const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

            return Math.round((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 2.55);
        }
        JS;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board), ['colorScheme' => 'dark']));
    $this->addWhiteboardSticky($page, 'Coral');
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->assertScript("document.documentElement.classList.contains('dark')", true)
        ->assertPresent('.whiteboard-canvas .excalidraw.theme--dark')
        ->assertPresent(R20Selection)
        ->assertCount(R20MinimapShape, 1)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    foreach ([R20Tools, R20History, R20Zoom, R20Minimap, R20Selection] as $bar) {
        expect((int) $page->script("() => ({$luminance})('{$bar}')"))->toBeLessThan(25, $bar);
    }

    $light = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board), ['colorScheme' => 'light']));

    expect((int) $light->script("() => ({$luminance})('".R20Tools."')"))->toBeGreaterThan(80);
});

it('[R20-18] names the bars and the tools in English for an English-speaking member and in French for a French-speaking one', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$camille] = whiteboardMember($board);
    renamedWhiteboardUser($camille, 'Camille Martin', 'fr');
    $labels = <<<'JS'
        (() => [
            ...[...document.querySelectorAll('.whiteboard-canvas [role="toolbar"]')].map((bar) => bar.getAttribute('aria-label')),
            ...[...document.querySelectorAll('.whiteboard-canvas [data-slot="canvas-tools"] [data-slot="whiteboard-tool"]')].map((tool) => tool.getAttribute('aria-label')),
            document.querySelector('.whiteboard-canvas [data-zoom-percent]').getAttribute('aria-label'),
        ].join('|'))()
        JS;

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $camillePage = $this->awaitRealtime($this->signIn($camille, $this->whiteboardPath($board), ['locale' => 'fr-FR']));

    $franPage->assertScript("document.documentElement.lang.startsWith('en')", true)
        ->assertScript($labels, 'History|Zoom|Tools|Selection|Hand|Sticky note|Shape|Connector|Text|Pencil|Eraser|Frame|Image|More tools|Reset zoom to 100 %');

    $camillePage->assertScript("document.documentElement.lang.startsWith('fr')", true)
        ->assertScript($labels, "Historique|Zoom|Outils|Sélection|Main|Post-it|Forme|Connecteur|Texte|Crayon|Gomme|Cadre|Image|Plus d'outils|Revenir au zoom 100\u{202F}%");
});
