<?php

use App\Models\WhiteboardElement;

const WhiteboardToolbarsTools = '.whiteboard-canvas [data-slot="canvas-tools"] [role="toolbar"][aria-label="Tools"]';
const WhiteboardToolbarsSubBar = '.whiteboard-canvas [data-slot="canvas-tools"] [data-slot="whiteboard-sub-bar"]';
const WhiteboardToolbarsHistory = '.whiteboard-canvas [role="toolbar"][aria-label="History"]';
const WhiteboardToolbarsZoom = '.whiteboard-canvas [role="toolbar"][aria-label="Zoom"]';
const WhiteboardToolbarsZoomLabel = '.whiteboard-canvas [role="toolbar"][aria-label="Zoom"] [data-zoom-percent]';
const WhiteboardToolbarsMinimap = '.whiteboard-canvas [data-slot="whiteboard-minimap"]';
const WhiteboardToolbarsMinimapShape = '.whiteboard-canvas [data-slot="whiteboard-minimap"] [data-slot="whiteboard-minimap-shape"]';
const WhiteboardToolbarsSelection = '.whiteboard-canvas [role="toolbar"][aria-label="Selection"]';
const WhiteboardToolbarsSelectionCount = '.whiteboard-canvas [data-slot="whiteboard-selection-count"]';
const WhiteboardToolbarsContainer = '.whiteboard-canvas .excalidraw-container';

/** The visible tools of a bar, in their order, as "item:key". */
const WhiteboardToolbarsToolOrder = <<<'JS'
    (() => [...document.querySelectorAll('.whiteboard-canvas [data-slot="canvas-tools"] [role="toolbar"][aria-label="Tools"] [data-slot="whiteboard-tool"]')]
        .map((tool) => `${tool.dataset.toolbarItem ?? tool.getAttribute('aria-label')}:${tool.getAttribute('aria-keyshortcuts') ?? ''}`)
        .join('|'))()
    JS;

/** The library's own chrome that the board hides: true when none of it is visible. */
const WhiteboardToolbarsNativeChromeHidden = <<<'JS'
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

function whiteboardToolbarsBox(mixed $page, string $selector): array
{
    $quoted = json_encode($selector, JSON_THROW_ON_ERROR);

    return json_decode((string) $page->script("() => { const box = document.querySelector({$quoted}).getBoundingClientRect(); const canvas = document.querySelector('.whiteboard-canvas').getBoundingClientRect(); return JSON.stringify({ left: box.left - canvas.left, top: box.top - canvas.top, right: canvas.right - box.right, bottom: canvas.bottom - box.bottom, width: box.width, height: box.height }); }"), true, flags: JSON_THROW_ON_ERROR);
}

function whiteboardToolbarsFocused(mixed $page): string
{
    return (string) $page->script("() => document.activeElement?.dataset.toolbarItem ?? document.activeElement?.getAttribute('aria-label') ?? ''");
}

it('replaces the library\'s chrome with the tool bar on the left, the history at the bottom left and the zoom bar over the minimap at the bottom right', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->assertPresent(WhiteboardToolbarsTools)
        ->assertAttribute(WhiteboardToolbarsTools, 'aria-orientation', 'vertical')
        ->assertScript(WhiteboardToolbarsToolOrder, 'select:V|hand:H|sticky:N|shape:R|connector:C|text:T|pen:P|eraser:E|frame:F|image:|More tools:')
        ->assertCount(WhiteboardToolbarsTools.' [data-slot="whiteboard-toolbar-separator"]', 2)
        ->assertAttribute(WhiteboardToolbarsTools.' [data-toolbar-item="select"]', 'aria-pressed', 'true')
        ->assertPresent(WhiteboardToolbarsHistory)
        ->assertPresent(WhiteboardToolbarsZoom)
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '100 %')
        ->assertPresent(WhiteboardToolbarsMinimap)
        ->assertScript(WhiteboardToolbarsNativeChromeHidden, true);

    $tools = whiteboardToolbarsBox($page, WhiteboardToolbarsTools);
    $history = whiteboardToolbarsBox($page, WhiteboardToolbarsHistory);
    $zoom = whiteboardToolbarsBox($page, WhiteboardToolbarsZoom);
    $minimap = whiteboardToolbarsBox($page, WhiteboardToolbarsMinimap);

    expect($tools['left'])->toEqualWithDelta(16, 1)
        ->and($history['left'])->toEqualWithDelta(16, 1)
        ->and($history['bottom'])->toEqualWithDelta(16, 1)
        ->and($zoom['right'])->toEqualWithDelta(16, 1)
        ->and($minimap['bottom'])->toEqualWithDelta(16, 1)
        ->and($minimap['right'])->toEqualWithDelta(16, 1)
        ->and($zoom['bottom'])->toBeGreaterThan($minimap['bottom'] + $minimap['height'])
        ->and($minimap['width'])->toEqualWithDelta(180, 1)
        ->and($minimap['height'])->toEqualWithDelta(112, 1)
        ->and($tools['top'] + $tools['height'])->toBeLessThan($history['top']);
});

it('sets the library\'s tool from the bar, shows a tool the library chose itself, and moves through the bar with the arrow keys, Home and End', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $tool = fn (string $item): string => WhiteboardToolbarsTools." [data-toolbar-item=\"{$item}\"]";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->click($tool('pen'))
        ->assertAttribute($tool('pen'), 'aria-pressed', 'true')
        ->assertAttribute($tool('select'), 'aria-pressed', 'false')
        ->assertScript("document.querySelector('.whiteboard-canvas .excalidraw').classList.contains('excalidraw--view-mode')", false)
        ->click($tool('hand'))
        ->assertAttribute($tool('hand'), 'aria-pressed', 'true')
        ->assertAttribute($tool('pen'), 'aria-pressed', 'false');

    $page->keys(WhiteboardToolbarsContainer, 'r')
        ->assertAttribute($tool('shape'), 'aria-pressed', 'true')
        ->assertPresent(WhiteboardToolbarsSubBar.'[aria-label="Shapes"]');

    $this->dragOnWhiteboard($page, [400, 300], [520, 380]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->assertNotPresent(WhiteboardToolbarsSubBar);

    $page->script("() => document.querySelector('".WhiteboardToolbarsTools." [data-toolbar-item=\"select\"]').focus()");

    expect(whiteboardToolbarsFocused($page))->toBe('select');

    $page->keys($tool('select'), 'ArrowDown');

    expect(whiteboardToolbarsFocused($page))->toBe('hand');

    $page->keys($tool('hand'), 'End');

    expect(whiteboardToolbarsFocused($page))->toBe('More tools');

    $page->keys(WhiteboardToolbarsTools.' [aria-label="More tools"]', 'Home');

    expect(whiteboardToolbarsFocused($page))->toBe('select');

    $page->keys($tool('select'), 'ArrowUp');

    expect(whiteboardToolbarsFocused($page))->toBe('More tools');

    $page->assertAttribute(WhiteboardToolbarsTools.' [aria-label="More tools"]', 'tabindex', '0')
        ->assertAttribute($tool('select'), 'tabindex', '-1');
});

it('adds a sticky note where the pointer presses with the sticky tool, returns to the selection, and shows the note to a guest without a reload', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));
    $this->awaitWhiteboardElements($franPage, 0);
    $this->awaitWhiteboardElements($guestPage, 0);

    $franPage->click(WhiteboardToolbarsTools.' [data-toolbar-item="sticky"]')
        ->assertAttribute(WhiteboardToolbarsTools.' [data-toolbar-item="sticky"]', 'aria-pressed', 'true')
        ->assertPresent(WhiteboardToolbarsSubBar.'[aria-label="Sticky note colours"]')
        ->assertCount(WhiteboardToolbarsSubBar.' [role="radio"]', 8)
        ->click(WhiteboardToolbarsSubBar.' [role="radio"][data-color="lagoon"]');

    $this->awaitWhiteboardStored($franPage, $board, 1);

    $franPage->assertAttribute(WhiteboardToolbarsTools.' [data-toolbar-item="select"]', 'aria-pressed', 'true')
        ->assertNotPresent(WhiteboardToolbarsSubBar)
        ->click(WhiteboardToolbarsTools.' [data-toolbar-item="sticky"]')
        ->assertPresent(WhiteboardToolbarsSubBar.' [role="radio"][data-color="lagoon"][aria-checked="true"]');

    $this->dragOnWhiteboard($franPage, [600, 340], [600, 340], 1);
    $this->awaitWhiteboardStored($franPage, $board, 2);
    $this->awaitWhiteboardScene($franPage, $board);

    $franPage->assertAttribute(WhiteboardToolbarsTools.' [data-toolbar-item="select"]', 'aria-pressed', 'true')
        ->assertPresent(WhiteboardToolbarsSelection)
        ->assertSeeIn(WhiteboardToolbarsSelectionCount, '1 element');

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

it('offers the kinds of shape with the eight fills and the kinds of connector, draws the chosen kind and keeps the last choice for the page', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $kinds = fn (string $group): string => WhiteboardToolbarsSubBar." [role=\"radiogroup\"][aria-label=\"{$group}\"] [role=\"radio\"]";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $page->click(WhiteboardToolbarsTools.' [data-toolbar-item="shape"]')
        ->assertPresent(WhiteboardToolbarsSubBar.'[aria-label="Shapes"]')
        ->assertScript("[...document.querySelectorAll('".WhiteboardToolbarsSubBar." [role=\"radiogroup\"][aria-label=\"Shape\"] [role=\"radio\"]')].map((kind) => kind.getAttribute('aria-label')).join('|')", 'Rectangle|Diamond|Ellipse')
        ->assertAttribute($kinds('Shape').'[aria-label="Rectangle"]', 'aria-checked', 'true')
        ->assertCount(WhiteboardToolbarsSubBar.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"]', 8)
        ->click($kinds('Shape').'[aria-label="Ellipse"]')
        ->assertAttribute($kinds('Shape').'[aria-label="Ellipse"]', 'aria-checked', 'true')
        ->click(WhiteboardToolbarsSubBar.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"][data-color="iris"]');

    $this->dragOnWhiteboard($page, [400, 300], [540, 400]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->click(WhiteboardToolbarsTools.' [data-toolbar-item="connector"]')
        ->assertPresent(WhiteboardToolbarsSubBar.'[aria-label="Connectors"]')
        ->assertScript("[...document.querySelectorAll('".WhiteboardToolbarsSubBar." [role=\"radiogroup\"][aria-label=\"Connector\"] [role=\"radio\"]')].map((kind) => kind.getAttribute('aria-label')).join('|')", 'Arrow|Line')
        ->assertAttribute($kinds('Connector').'[aria-label="Arrow"]', 'aria-checked', 'true')
        ->assertNotPresent(WhiteboardToolbarsSubBar.' [role="radiogroup"][aria-label="Fill colour"]')
        ->click($kinds('Connector').'[aria-label="Line"]');

    $this->dragOnWhiteboard($page, [700, 300], [860, 420]);
    $this->awaitWhiteboardStored($page, $board, 2);

    $page->click(WhiteboardToolbarsTools.' [data-toolbar-item="shape"]')
        ->assertAttribute($kinds('Shape').'[aria-label="Ellipse"]', 'aria-checked', 'true')
        ->click(WhiteboardToolbarsTools.' [data-toolbar-item="connector"]')
        ->assertAttribute($kinds('Connector').'[aria-label="Line"]', 'aria-checked', 'true');

    $this->awaitWhiteboardScene($page, $board);

    $elements = WhiteboardElement::query()->where('whiteboard_id', $board->id)->orderBy('seq')->get();

    expect($elements->pluck('type')->all())->toBe(['ellipse', 'line'])
        ->and($elements[0]->data['backgroundColor'])->toBe('#efeeff');
});

it('undoes and redoes the member\'s own drawing from the history bar, which is disabled while there is nothing to undo or redo', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $undo = WhiteboardToolbarsHistory.' button[aria-label="Undo"]';
    $redo = WhiteboardToolbarsHistory.' button[aria-label="Redo"]';

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

it('zooms by steps of ten per cent from the zoom bar, stops at ten per cent, resets to one hundred and fits every element in the view', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $zoomIn = WhiteboardToolbarsZoom.' button[aria-label="Zoom in"]';
    $zoomOut = WhiteboardToolbarsZoom.' button[aria-label="Zoom out"]';
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
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '110 %')
        ->click($zoomIn)
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '120 %')
        ->click(WhiteboardToolbarsZoomLabel)
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '100 %');

    foreach (range(90, 10, 10) as $percent) {
        $page->click($zoomOut)
            ->assertSeeIn(WhiteboardToolbarsZoomLabel, "{$percent} %");
    }

    $page->assertPresent("{$zoomOut}[aria-disabled=\"true\"]:focus")
        ->assertNotPresent("{$zoomIn}[aria-disabled]")
        ->click(WhiteboardToolbarsZoomLabel)
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '100 %');

    $this->addWhiteboardElement($page, $board, ['x' => 200, 'y' => 200]);
    $this->addWhiteboardElement($page, $board, ['x' => 3200, 'y' => 2400]);
    $this->awaitWhiteboardElements($page, 2);

    $page->assertScript($viewHoldsEveryShape, false)
        ->click(WhiteboardToolbarsZoom.' button[aria-label="Fit to screen"]')
        ->assertScript($viewHoldsEveryShape, true)
        ->assertDontSeeIn(WhiteboardToolbarsZoomLabel, '100 %');
});

it('draws every element on the minimap in its colour, follows a guest\'s new note live, centres the view where it is pressed and remembers when it is closed', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $toggle = WhiteboardToolbarsZoom.' button[aria-label="Minimap"]';
    $coloured = "[...document.querySelectorAll('".WhiteboardToolbarsMinimapShape."')].filter((shape) => parseFloat(getComputedStyle(shape).borderTopWidth) > 0).length";
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

    $franPage->assertPresent(WhiteboardToolbarsMinimap.' [role="img"][aria-label="Minimap"]')
        ->assertAttribute($toggle, 'aria-pressed', 'true')
        ->assertCount(WhiteboardToolbarsMinimapShape, 0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 100, 'y' => 100]);
    $this->addWhiteboardElement($franPage, $board, ['x' => 4000, 'y' => 3000, 'backgroundColor' => '#e1f8dc', 'strokeColor' => '#a5d39b']);
    $this->awaitWhiteboardElements($franPage, 2);

    $franPage->assertCount(WhiteboardToolbarsMinimapShape, 2)
        ->assertScript($coloured, 1);

    $this->awaitWhiteboardElements($guestPage, 2);
    $this->addWhiteboardSticky($guestPage, 'Plum');
    $this->awaitWhiteboardElements($franPage, 3);

    $franPage->assertCount(WhiteboardToolbarsMinimapShape, 3)
        ->assertScript($coloured, 2);

    $franPage->assertScript("{$viewCentreOffset} > 20", true)
        ->click(WhiteboardToolbarsMinimap.' [role="img"]')
        ->assertScript("{$viewCentreOffset} < 4", true);

    $viewLeft = (float) $franPage->script("() => document.querySelector('.whiteboard-canvas [data-slot=whiteboard-minimap-view]').getBoundingClientRect().left");

    $franPage->keys(WhiteboardToolbarsMinimap.' button[aria-label="Move the view"]', 'ArrowRight')
        ->assertScript("document.querySelector('.whiteboard-canvas [data-slot=whiteboard-minimap-view]').getBoundingClientRect().left > {$viewLeft} + 2", true);

    $franPage->click($toggle)
        ->assertAttribute($toggle, 'aria-pressed', 'false')
        ->assertNotPresent(WhiteboardToolbarsMinimap);

    $franPage = $this->awaitRealtime($franPage->navigate($this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($franPage, 3);

    $franPage->assertAttribute($toggle, 'aria-pressed', 'false')
        ->assertNotPresent(WhiteboardToolbarsMinimap)
        ->keys(WhiteboardToolbarsContainer, 'm')
        ->assertPresent(WhiteboardToolbarsMinimap)
        ->assertAttribute($toggle, 'aria-pressed', 'true');
});

it('shows the selection bar and the element count under a selection, groups, aligns and deletes from it, offers colours only for filled elements and goes away on deselect', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $fill = WhiteboardToolbarsSelection.' [role="radiogroup"][aria-label="Fill colour"]';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $first = $this->addWhiteboardElement($page, $board, ['x' => 400, 'y' => 300]);
    $second = $this->addWhiteboardElement($page, $board, ['x' => 560, 'y' => 420]);
    $this->awaitWhiteboardElements($page, 2);

    $page->assertNotPresent(WhiteboardToolbarsSelection);

    $this->dragOnWhiteboard($page, [360, 260], [720, 520]);

    $page->assertPresent(WhiteboardToolbarsSelection)
        ->assertSeeIn(WhiteboardToolbarsSelectionCount, '2 elements')
        ->assertPresent($fill)
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Group"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Lock"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Styles"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Delete"]');

    $bar = whiteboardToolbarsBox($page, WhiteboardToolbarsSelection);
    $chip = whiteboardToolbarsBox($page, WhiteboardToolbarsSelectionCount);

    expect($bar['top'])->toBeGreaterThan(470)
        ->and($chip['top'])->toBeLessThan(300)
        ->and($chip['left'])->toEqualWithDelta(400, 12);

    $page->click(WhiteboardToolbarsSelection.' button[aria-label="Group"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Ungroup"]');

    $this->awaitWhiteboardScene($page, $board);

    $groups = WhiteboardElement::query()->where('whiteboard_id', $board->id)->get()->map(fn (WhiteboardElement $element): array => $element->data['groupIds']);

    expect($groups[0])->toHaveCount(1)
        ->and($groups[1])->toBe($groups[0]);

    $page->click(WhiteboardToolbarsSelection.' button[aria-label="Ungroup"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Group"]');

    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->get()->every(fn (WhiteboardElement $element): bool => $element->data['groupIds'] === []))->toBeTrue();

    $page->click(WhiteboardToolbarsSelection.' button[aria-label="Align"]')
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Distribute horizontally")[data-disabled]')
        ->click('[role="menu"] [role="menuitem"]:has-text("Align left")');

    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->get()->map(fn (WhiteboardElement $element): float => (float) $element->data['x'])->unique()->values()->all())->toBe([400.0]);

    $this->dragOnWhiteboard($page, [1000, 700], [1000, 700], 1);

    $page->assertNotPresent(WhiteboardToolbarsSelection)
        ->assertNotPresent(WhiteboardToolbarsSelectionCount);

    $this->addWhiteboardSticky($page, 'Sky');
    $this->awaitWhiteboardStored($page, $board, 3);

    $page->assertSeeIn(WhiteboardToolbarsSelectionCount, '1 element')
        ->assertPresent("{$fill} [role=\"radio\"][data-color=\"sky\"][aria-checked=\"true\"]")
        ->assertNotPresent(WhiteboardToolbarsSelection.' button[aria-label="Group"]')
        ->click(WhiteboardToolbarsSelection.' button[aria-label="Delete"]')
        ->assertNotPresent(WhiteboardToolbarsSelection);

    $this->awaitWhiteboardStored($page, $board, 2);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', true)->sole()->is_sticky)->toBeTrue();

    $this->drawOnWhiteboard($page, 'line', [800, 300], [960, 380]);
    $this->awaitWhiteboardStored($page, $board, 3);

    $page->assertPresent(WhiteboardToolbarsSelection)
        ->assertSeeIn(WhiteboardToolbarsSelectionCount, '1 element')
        ->assertNotPresent($fill)
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Delete"]');

    expect(collect([$first['id'], $second['id']])->diff(WhiteboardElement::query()->where('whiteboard_id', $board->id)->pluck('element_id')))->toBeEmpty();
});

it('shows Lock to the facilitator only, stores the lock, and disables the colours and Delete with the reason for a member whose selection the facilitator locks', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedUser($mia, 'Mia Member');
    $reason = 'Only the facilitator can change a locked element.';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($franPage, 0);

    $shape = $this->addWhiteboardElement($franPage, $board, ['x' => 400, 'y' => 300, 'width' => 160, 'height' => 100, 'backgroundColor' => '#fdf1c2', 'strokeColor' => '#ddc362']);
    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($miaPage, 1);

    $this->dragOnWhiteboard($miaPage, [480, 350], [480, 350], 1);

    $miaPage->assertPresent(WhiteboardToolbarsSelection)
        ->assertNotPresent(WhiteboardToolbarsSelection.' button[aria-label="Lock"]')
        ->assertPresent(WhiteboardToolbarsSelection.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"]:enabled')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Delete"]:enabled');

    $this->dragOnWhiteboard($franPage, [480, 350], [480, 350], 1);

    $franPage->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Lock"][aria-pressed="false"]')
        ->click(WhiteboardToolbarsSelection.' button[aria-label="Lock"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Lock"][aria-pressed="true"]');

    $this->awaitWhiteboardScene($franPage, $board);

    expect(WhiteboardElement::query()->where('element_id', $shape['id'])->sole()->data['locked'])->toBeTrue();

    $this->awaitWhiteboardScene($miaPage, $board);

    $miaPage->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Delete"]:disabled')
        ->assertPresent(WhiteboardToolbarsSelection.' [role="radiogroup"][aria-label="Fill colour"] [role="radio"]:disabled')
        ->assertScript("document.getElementById(document.querySelector('".WhiteboardToolbarsSelection." button[aria-label=\"Delete\"]').getAttribute('aria-describedby')).textContent", $reason)
        ->assertScript("document.getElementById(document.querySelector('".WhiteboardToolbarsSelection." [role=\"radiogroup\"][aria-label=\"Fill colour\"]').getAttribute('aria-describedby')).textContent", $reason)
        ->assertNotPresent(WhiteboardToolbarsSelection.' button[aria-label="Lock"]');

    $franPage->click(WhiteboardToolbarsSelection.' button[aria-label="Lock"][aria-pressed="true"]')
        ->assertPresent(WhiteboardToolbarsSelection.' button[aria-label="Lock"][aria-pressed="false"]');

    $this->awaitWhiteboardScene($franPage, $board);

    expect(WhiteboardElement::query()->where('element_id', $shape['id'])->sole()->data['locked'])->toBeFalse();
});

it('shows the library\'s property panel beside the tool bar under Styles, clear of the selection bar, with options of 2 by 1.75rem, stores what it changes and hides it again', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $panel = '.whiteboard-canvas .excalidraw .selected-shape-actions';
    $panelShown = "getComputedStyle(document.querySelector('{$panel}')).visibility === 'visible'";
    $hitAt = 'const hit = (part) => { const box = part.getBoundingClientRect(); return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); };';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 0);

    $this->drawOnWhiteboard($page, 'rectangle', [400, 300], [560, 420]);
    $this->awaitWhiteboardStored($page, $board, 1);

    $page->assertAttribute(WhiteboardToolbarsSelection.' button[aria-label="Styles"]', 'aria-pressed', 'false')
        ->assertScript($panelShown, false)
        ->assertScript("[...document.querySelectorAll('{$panel} *')].filter((part) => part.checkVisibility({ visibilityProperty: true })).length", 0)
        ->assertScript("(() => { {$hitAt} return hit(document.querySelector('{$panel} .App-menu__left')).className; })()", 'excalidraw__canvas interactive')
        ->assertScript("(() => { {$hitAt} const panel = document.querySelector('{$panel}'); return [...panel.querySelectorAll('button')].filter((control) => panel.contains(hit(control))).length; })()", 0)
        ->assertScript("(() => { const control = document.querySelector('{$panel} button'); control.focus(); return document.activeElement === control; })()", false)
        ->click(WhiteboardToolbarsSelection.' button[aria-label="Styles"]')
        ->assertAttribute(WhiteboardToolbarsSelection.' button[aria-label="Styles"]', 'aria-pressed', 'true')
        ->assertScript($panelShown, true)
        ->assertScript("document.querySelector('{$panel} .value-bubble').textContent", '100')
        ->assertScript("(() => { const box = (part) => document.querySelector(`{$panel} \${part}`).getBoundingClientRect(); return box('.value-bubble').left - box('.zero-label').right > 100; })()", true);

    $panelBox = whiteboardToolbarsBox($page, $panel);
    $option = whiteboardToolbarsBox($page, "{$panel} label:has([data-testid=\"strokeWidth-extraBold\"])");

    expect($panelBox['left'])->toBeGreaterThan(whiteboardToolbarsBox($page, WhiteboardToolbarsTools)['left'] + whiteboardToolbarsBox($page, WhiteboardToolbarsTools)['width'])
        ->and(whiteboardToolbarsBox($page, WhiteboardToolbarsSelection)['left'])->toBeGreaterThan($panelBox['left'] + $panelBox['width'])
        ->and($option['width'])->toEqualWithDelta(32, 0.5)
        ->and($option['height'])->toEqualWithDelta(28, 0.5);

    $page->click("{$panel} label:has([data-testid=\"strokeWidth-extraBold\"])")
        ->click("{$panel} [data-testid=\"fill-cross-hatch\"]");

    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data)
        ->toMatchArray(['strokeWidth' => 4, 'fillStyle' => 'cross-hatch']);

    $page->click(WhiteboardToolbarsSelection.' button[aria-label="Styles"]')
        ->assertAttribute(WhiteboardToolbarsSelection.' button[aria-label="Styles"]', 'aria-pressed', 'false')
        ->assertScript($panelShown, false);
});

it('finds on the canvas, clears the canvas after the confirmation and changes the background of the dotted paper under the see-through canvas from the board menu', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $backgroundPixel = <<<'JS'
        (() => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.static');
            const pixel = canvas.getContext('2d').getImageData(canvas.width - 40, 40, 1, 1).data;
            const paper = getComputedStyle(document.querySelector('.whiteboard-canvas [data-slot="whiteboard-paper"]'));
            const channels = paper.backgroundColor.match(/\d+/g).slice(0, 3).map(Number);

            return pixel[3] === 0 && paper.backgroundImage.includes('radial-gradient')
                ? '#' + channels.map((value) => value.toString(16).padStart(2, '0')).join('')
                : 'opaque canvas';
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

it('leaves only the zoom bar and the minimap to a member when the facilitator locks the board, and gives the tools back on unlock', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($miaPage, 0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 400, 'y' => 300, 'backgroundColor' => '#fdf1c2']);
    $this->awaitWhiteboardElements($miaPage, 1);
    $this->dragOnWhiteboard($miaPage, [450, 325], [450, 325], 1);

    $miaPage->assertPresent(WhiteboardToolbarsTools)
        ->assertPresent(WhiteboardToolbarsHistory)
        ->assertPresent(WhiteboardToolbarsSelection);

    $franPage->click('[data-slot="board-facilitation"] [aria-label="Lock the board"]')
        ->assertPresent('[data-slot="board-facilitation"] [aria-label="Unlock the board"]');

    $miaPage->assertPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertNotPresent(WhiteboardToolbarsTools)
        ->assertNotPresent(WhiteboardToolbarsHistory)
        ->assertNotPresent(WhiteboardToolbarsSelection)
        ->assertNotPresent(WhiteboardToolbarsSelectionCount)
        ->assertPresent(WhiteboardToolbarsZoom)
        ->assertPresent(WhiteboardToolbarsMinimap)
        ->click(WhiteboardToolbarsZoom.' button[aria-label="Zoom in"]')
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '110 %');

    $franPage->assertPresent(WhiteboardToolbarsTools)
        ->assertPresent(WhiteboardToolbarsHistory)
        ->click('[data-slot="board-facilitation"] [aria-label="Unlock the board"]');

    $miaPage->assertNotPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertPresent(WhiteboardToolbarsTools)
        ->assertPresent(WhiteboardToolbarsHistory);
});

it('pauses a guest who follows the facilitator when the guest moves the view with the minimap, and brings the guest back on Resume', function () {
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
        ->click(WhiteboardToolbarsMinimap.' [role="img"]')
        ->assertPresent($paused)
        ->assertNotPresent($following);

    $guestZoom = $guestPage->script('() => document.querySelector(\''.WhiteboardToolbarsZoomLabel.'\').textContent');

    expect($guestZoom)->toEndWith('%')->not->toStartWith('110');

    $franPage->click(WhiteboardToolbarsZoom.' button[aria-label="Zoom in"]')
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '110 %');
    $this->settleWhiteboard($guestPage, 400);

    $guestPage->assertPresent($paused)
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, $guestZoom)
        ->click('div[role="status"] button:text-is("Resume")')
        ->assertPresent($following)
        ->assertNotPresent($paused)
        ->assertSeeIn(WhiteboardToolbarsZoomLabel, '110 %');
});

it('opens a phone on the board fitted to its screen, docks Fit to screen and Edit in read mode, then a compact bar of Selection, Sticky note, Pencil and More tools whose drawer holds the other phone tools, without zoom bar, minimap, connector or frame', function () {
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
        ->assertNotPresent(WhiteboardToolbarsZoom)
        ->assertNotPresent(WhiteboardToolbarsMinimap)
        ->assertNotPresent(WhiteboardToolbarsHistory)
        ->assertNotPresent($phoneTools)
        ->assertNotPresent($scrollBack)
        ->click("{$dock} button[aria-label=\"Fit to screen\"]")
        ->assertNotPresent($scrollBack)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->click("{$dock} [data-slot=\"read-mode-toggle\"]")
        ->assertPresent($phoneTools)
        ->assertAttribute($phoneTools, 'aria-orientation', 'horizontal')
        ->assertScript("[...document.querySelectorAll('{$phoneTools} [data-slot=\"whiteboard-tool\"]')].map((tool) => tool.getAttribute('aria-label')).join('|')", 'Selection|Sticky note|Pencil|More tools')
        ->assertNotPresent(WhiteboardToolbarsZoom)
        ->assertNotPresent(WhiteboardToolbarsMinimap)
        ->assertNotPresent(WhiteboardToolbarsHistory)
        ->assertNotPresent(WhiteboardToolbarsTools)
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

it('answers N, C and M on the canvas and in the tool bar, never in a field, and none of the single-character keys once the guest turns single-key shortcuts off', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $tool = fn (string $item): string => WhiteboardToolbarsTools." [data-toolbar-item=\"{$item}\"]";
    $toggle = WhiteboardToolbarsZoom.' button[aria-label="Minimap"]';
    $search = '[data-slot="keyboard-shortcuts"] input[aria-label="Search shortcuts"]';

    $page = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));
    $this->awaitWhiteboardElements($page, 0);

    $page->keys(WhiteboardToolbarsContainer, 'n')
        ->assertAttribute($tool('sticky'), 'aria-pressed', 'true')
        ->keys(WhiteboardToolbarsContainer, 'c')
        ->assertAttribute($tool('connector'), 'aria-pressed', 'true')
        ->keys(WhiteboardToolbarsContainer, 'm')
        ->assertNotPresent(WhiteboardToolbarsMinimap)
        ->assertAttribute($toggle, 'aria-pressed', 'false')
        ->keys($tool('connector'), 'n')
        ->assertAttribute($tool('sticky'), 'aria-pressed', 'true')
        ->keys($tool('sticky'), 'v')
        ->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->keys($toggle, 'm')
        ->assertPresent(WhiteboardToolbarsMinimap)
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

    $page->keys(WhiteboardToolbarsContainer, 'n')
        ->keys(WhiteboardToolbarsContainer, 'r')
        ->keys(WhiteboardToolbarsContainer, 'm');

    $this->settleWhiteboard($page, 400);

    $page->assertAttribute($tool('select'), 'aria-pressed', 'true')
        ->assertAttribute($tool('sticky'), 'aria-pressed', 'false')
        ->assertAttribute($tool('shape'), 'aria-pressed', 'false')
        ->assertPresent(WhiteboardToolbarsMinimap)
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

    $page->keys(WhiteboardToolbarsContainer, 'n');
    $this->settleWhiteboard($page, 400);

    $page->assertAttribute($tool('sticky'), 'aria-pressed', 'false');
});

it('lists the board\'s keys as built in the Whiteboard section of the keyboard shortcuts dialog', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $section = '[data-slot="keyboard-shortcuts-section"][aria-label="Whiteboard"]';

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $page->click('header button[aria-label="Keyboard shortcuts"]')
        ->assertPresent($section)
        ->assertScript("[...document.querySelectorAll('{$section} [data-slot=\"keyboard-shortcuts-row\"]')].map((row) => row.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 10).join('|')", 'Selection V|Hand H|Sticky note N|Shape R|Connector C|Text T|Pencil P|Eraser E|Frame F|Minimap M')
        ->assertDontSeeIn($section, 'The whiteboard uses the shortcuts of its own toolbar.');
});

it('draws the bars, the minimap and the canvas of the board in the dark theme without a horizontal scroll', function () {
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
        ->assertPresent(WhiteboardToolbarsSelection)
        ->assertCount(WhiteboardToolbarsMinimapShape, 1)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    foreach ([WhiteboardToolbarsTools, WhiteboardToolbarsHistory, WhiteboardToolbarsZoom, WhiteboardToolbarsMinimap, WhiteboardToolbarsSelection] as $bar) {
        expect((int) $page->script("() => ({$luminance})('{$bar}')"))->toBeLessThan(25, $bar);
    }

    $light = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board), ['colorScheme' => 'light']));

    expect((int) $light->script("() => ({$luminance})('".WhiteboardToolbarsTools."')"))->toBeGreaterThan(80);
});

it('names the bars and the tools in English for an English-speaking member and in French for a French-speaking one', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$camille] = whiteboardMember($board);
    renamedUser($camille, 'Camille Martin', 'fr');
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
        ->assertScript($labels, 'Facilitation tools|History|Zoom|Tools|Selection|Hand|Sticky note|Shape|Connector|Text|Pencil|Eraser|Frame|Image|More tools|Reset zoom to 100 %');

    $camillePage->assertScript("document.documentElement.lang.startsWith('fr')", true)
        ->assertScript($labels, "Historique|Zoom|Outils|Sélection|Main|Post-it|Forme|Connecteur|Texte|Crayon|Gomme|Cadre|Image|Plus d'outils|Revenir au zoom 100\u{202F}%");
});
