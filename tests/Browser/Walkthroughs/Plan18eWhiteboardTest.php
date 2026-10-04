<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Models\User;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Support\WhiteboardTemplates\BuiltInTemplates;

it('[P18e-07-01] prefills the name on the guest-join page, lets the visitor in with "Join the session", and shows the notice for an invalid link', function () {
    ['board' => $board] = whiteboardWithFacilitator();
    whiteboardGuest($board);
    $oscar = renamedWhiteboardUser(User::factory()->create(), 'Oscar Outsider');
    $joinPath = $this->whiteboardJoinPath($board);

    $page = $this->signIn($oscar, $joinPath);

    $page->assertPathIs($joinPath)
        ->assertSee('Join as a guest')
        ->assertSeeIn('[data-slot="guest-join-session"][data-kind="whiteboard"]', 'Sprint board')
        ->assertSeeIn('[data-slot="guest-join-status"]', 'Live')
        ->assertSeeIn('[data-slot="guest-join-participants"]', '2 participants')
        ->assertSeeIn('[data-slot="guest-join-facilitator"]', 'Fran Facilitator facilitates')
        ->assertValue('#name', 'Oscar Outsider')
        ->assertNotPresent('[data-slot="guest-join-preview"]:has-text("Suggested nickname")')
        ->fill('#name', '')
        ->assertNotPresent('[data-slot="guest-join-preview"]')
        ->assertDontSee('Suggested nickname if you leave it empty')
        ->click('Join the session')
        ->assertPathIs($joinPath)
        ->assertPresent('#name[aria-invalid="true"]')
        ->assertPresent('#name ~ [role="alert"]')
        ->assertScript('document.querySelector(\'#name ~ [role="alert"]\').textContent.trim() !== \'\'', true)
        ->fill('#name', 'Oscar Outsider')
        ->assertNotPresent('#name ~ [role="alert"]')
        ->click('Join the session')
        ->assertPathIs($this->whiteboardPath($board));

    $this->awaitRealtime($page)
        ->assertPresent('header img[data-presence-id][alt="Oscar Outsider"]');

    expect(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('guest_name', 'Oscar Outsider')->count())->toBe(1);

    $board->update(['guest_access_enabled' => false]);

    $visitorPage = visit($joinPath);

    $visitorPage->assertSee('Join a whiteboard')
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name')
        ->assertNotPresent('[data-slot="guest-join"]');
});

it('[P18e-07-02] shows the back link, the title, the people present and the facilitation tools in the header, and keeps the guest link in the Share dialog', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');
    $joinPath = $this->whiteboardJoinPath($board);
    $tools = 'header [role="toolbar"][aria-label="Facilitation tools"]';
    $share = '[data-slot="share-dialog"]';
    $linkEndsWithJoinPath = "document.querySelector('[data-slot=\"share-dialog\"] input[aria-label=\"Guest link\"]').value.endsWith('{$joinPath}')";

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($joinPath, 'Guest Gia'));

    $franPage->assertPresent('header a[aria-label="Back to the team"]')
        ->assertSeeIn('header span > h1', 'Sprint board')
        ->assertPresent('header [role="group"][aria-label="3 online"]')
        ->assertPresent("{$tools} [aria-label=\"Timer\"]")
        ->assertPresent("{$tools} [aria-label=\"Lock the board\"][aria-pressed=\"false\"]")
        ->assertPresent("{$tools} [aria-label=\"Bring everyone to me\"][aria-pressed=\"false\"]")
        ->assertPresent('header button[aria-label="Export"]')
        ->assertPresent('header [aria-label="Board menu"]')
        ->assertCount('[data-realtime]', 1)
        ->click('header button[aria-label="Share"]')
        ->assertScript($linkEndsWithJoinPath, true)
        ->assertPresent("{$share} [data-slot=\"share-qr\"]")
        ->assertPresent("{$share} button:has-text(\"Copy link\")")
        ->assertPresent("{$share} button:has-text(\"Create a new link\")")
        ->assertAriaAttribute('#whiteboard-guest-access', 'checked', 'true');

    $miaPage->assertPresent('header a[aria-label="Back to the team"]')
        ->assertNotPresent($tools)
        ->click('header button[aria-label="Share"]')
        ->assertScript($linkEndsWithJoinPath, true)
        ->assertPresent("{$share} button:has-text(\"Copy link\")")
        ->assertNotPresent('#whiteboard-guest-access')
        ->assertNotPresent("{$share} button:has-text(\"Create a new link\")");

    $guestPage->assertSeeIn('header span > h1', 'Sprint board')
        ->assertNotPresent('header a[aria-label="Back to the team"]')
        ->assertNotPresent($tools)
        ->assertNotPresent('button[aria-label="Share"]')
        ->assertPresent('header [aria-label="Board menu"]')
        ->assertCount('[data-realtime]', 1);

    $this->openWhiteboardMenu($guestPage)
        ->assertDontSeeIn('[role="menu"]', 'guest link');
});

it('[P18e-07-04] keeps the reactions bar clear of the canvas\'s scroll-back button at 1440 and at 390, with one realtime root', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $apart = <<<'JS'
        (() => {
            const bar = document.querySelector('.whiteboard-reactions').getBoundingClientRect();
            const button = document.querySelector('.whiteboard-canvas .scroll-back-to-content').getBoundingClientRect();

            return button.width > 0 && bar.width > 0 && (button.bottom <= bar.top || button.top >= bar.bottom || button.right <= bar.left || button.left >= bar.right);
        })()
        JS;
    $panAway = <<<'JS'
        async () => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');

            for (let step = 0; step < 12; step += 1) {
                canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY: 1500 }));
                await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
            }

            return true;
        }
        JS;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->addWhiteboardElement($page, $board);
    $this->awaitWhiteboardElements($page, 1);

    foreach ([[1440, 900], [390, 844]] as [$width, $height]) {
        $page->resize($width, $height);
        $page->script($panAway);

        $page->assertPresent('.whiteboard-canvas .scroll-back-to-content')
            ->assertPresent('.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]')
            ->assertScript($apart, true)
            ->assertCount('[data-realtime]', 1)
            ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);
    }
});

it('[P18e-07-06] renames the board in place for everyone, gives a guest no field, and opens the export dialog from the header', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $field = 'header input[aria-label="Board name"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $guestPage->assertSeeIn('header span > h1', 'Sprint board')
        ->assertNotPresent('header span > h1 button')
        ->assertNotPresent('[aria-label="Rename the board"]')
        ->keys('header span > h1', 'F2')
        ->assertNotPresent($field);

    $franPage->assertAttribute('header span > h1 button', 'aria-description', 'Rename the board')
        ->assertScript('document.title.startsWith("Sprint board")', true)
        ->click('header span > h1 button')
        ->assertValue($field, 'Sprint board')
        ->fill($field, 'Not this name')
        ->keys($field, 'Escape')
        ->assertNotPresent($field)
        ->assertSeeIn('header span > h1', 'Sprint board');

    $this->settleWhiteboard($franPage);

    expect($board->fresh()->title)->toBe('Sprint board');

    $franPage->keys('header span > h1 button', 'F2')
        ->fill($field, 'Onboarding journey')
        ->keys($field, 'Enter')
        ->assertNotPresent($field)
        ->assertSeeIn('header span > h1', 'Onboarding journey')
        ->assertScript('document.title.startsWith("Onboarding journey")', true);

    $guestPage->assertSeeIn('header span > h1', 'Onboarding journey')
        ->assertScript('document.title.startsWith("Onboarding journey")', true)
        ->assertNotPresent('header span > h1 button');

    expect($board->fresh()->title)->toBe('Onboarding journey');

    $franPage->click('header span > h1 button')
        ->fill($field, 'Left by a click on the canvas')
        ->click('.whiteboard-canvas canvas.excalidraw__canvas.interactive')
        ->assertNotPresent($field)
        ->assertSeeIn('header span > h1', 'Left by a click on the canvas');

    $guestPage->assertSeeIn('header span > h1', 'Left by a click on the canvas');

    expect($board->fresh()->title)->toBe('Left by a click on the canvas');

    $this->blockWhiteboardRequests($franPage, '/settings');

    $franPage->click('header span > h1 button')
        ->fill($field, 'Refused name')
        ->keys($field, 'Enter')
        ->assertValue($field, 'Refused name')
        ->assertScript('document.activeElement === document.querySelector(\'header input[aria-label="Board name"]\')', true)
        ->assertScript('document.querySelector(\'header input[aria-label="Board name"]\').readOnly', false);

    $this->unblockWhiteboardRequests($franPage);

    $franPage->keys($field, 'Escape')
        ->assertNotPresent($field)
        ->assertSeeIn('header span > h1', 'Left by a click on the canvas');

    expect($board->fresh()->title)->toBe('Left by a click on the canvas');

    $this->openWhiteboardMenu($franPage)
        ->assertPresent('[role="menuitem"]:has-text("Rename")');

    $franPage->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]')
        ->click('header button[aria-label="Export"]')
        ->assertSee('Download board data');

    $guestPage->click('header button[aria-label="Export"]')
        ->assertSee('Download board data');
});

it('[P18e-07-07] recolours a selected rectangle and a selected sticky from the selection bar, hides the canvas\'s quick picks but keeps its colour picker under Styles, and checks the colour of a template note', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $selectionBar = '.whiteboard-canvas [role="toolbar"][aria-label="Selection"]';
    $bar = "{$selectionBar} [role=\"radiogroup\"][aria-label=\"Fill colour\"]";
    $quickPicksHidden = <<<'JS'
        (() => {
            const picks = [...document.querySelectorAll('.whiteboard-canvas .color-picker__top-picks')];

            return picks.length > 0 && picks.every((pick) => getComputedStyle(pick).display === 'none');
        })()
        JS;
    $pickerRowsCollapsed = <<<'JS'
        (() => {
            const rows = [...document.querySelectorAll('.whiteboard-canvas .color-picker-container')];

            return rows.length > 0 && rows.every((row) => {
                const shown = [...row.children].filter((child) => getComputedStyle(child).display !== 'none');

                return shown.length === 1
                    && (shown[0].matches('button.color-picker__button') || shown[0].querySelector('button.color-picker__button') !== null)
                    && shown[0].getBoundingClientRect().left - row.getBoundingClientRect().left < 2;
            });
        })()
        JS;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $page->assertNotPresent($bar);

    $this->selectWhiteboardTool($page, 'rectangle');

    $page->assertNotPresent($bar);

    $this->dragOnWhiteboard($page, [420, 320], [580, 420]);
    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    $rectangle = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($rectangle->data['backgroundColor'])->toBe('#fdf1c2')
        ->and($rectangle->data['strokeColor'])->toBe('#ddc362')
        ->and($rectangle->is_sticky)->toBeFalse();

    $page->assertCount("{$bar} [role=\"radio\"]", 8)
        ->assertPresent("{$bar} [role=\"radio\"][aria-label=\"Sun\"][aria-checked=\"true\"]")
        ->click("{$selectionBar} button[aria-label=\"Styles\"]")
        ->assertAttribute("{$selectionBar} button[aria-label=\"Styles\"]", 'aria-pressed', 'true')
        ->assertScript($quickPicksHidden, true)
        ->assertScript($pickerRowsCollapsed, true)
        ->click("{$bar} [role=\"radio\"][aria-label=\"Sky\"]")
        ->assertPresent("{$bar} [role=\"radio\"][aria-label=\"Sky\"][aria-checked=\"true\"]");

    $this->awaitWhiteboardScene($page, $board);

    expect($rectangle->fresh()->data['backgroundColor'])->toBe('#e2f3ff')
        ->and($rectangle->fresh()->data['strokeColor'])->toBe('#8dccf9');

    $page->click('.whiteboard-canvas button.color-picker__button.active-color[aria-label="Background"]')
        ->assertPresent('.color-picker-content')
        ->keys('.color-picker-content', 'Escape')
        ->assertNotPresent('.color-picker-content');

    $this->addWhiteboardSticky($page, 'Coral');
    $this->awaitWhiteboardStored($page, $board, 2);
    $this->awaitWhiteboardScene($page, $board);

    $sticky = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->sole();

    expect($sticky->data['backgroundColor'])->toBe('#ffebe8')
        ->and($sticky->data['strokeColor'])->toBe('#f9aea4');

    $page->assertPresent("{$bar} [role=\"radio\"][aria-label=\"Coral\"][aria-checked=\"true\"]")
        ->click("{$bar} [role=\"radio\"][aria-label=\"Moss\"]");

    $this->awaitWhiteboardScene($page, $board);

    expect($sticky->fresh()->data['backgroundColor'])->toBe('#e1f8dc')
        ->and($sticky->fresh()->data['strokeColor'])->toBe('#a5d39b')
        ->and($sticky->fresh()->is_sticky)->toBeTrue()
        ->and($rectangle->fresh()->data['backgroundColor'])->toBe('#e2f3ff');

    $fromTemplate = resolve(CreateWhiteboard::class)->handle($board->team, $fran, 'SWOT of the quarter', [
        'elements' => resolve(BuiltInTemplates::class)->elements('swot'),
        'files' => [],
    ]);
    $note = WhiteboardElement::query()
        ->where('whiteboard_id', $fromTemplate->id)
        ->get()
        ->first(fn (WhiteboardElement $element): bool => $element->data['backgroundColor'] === '#ffebe8');
    $middle = [$note->data['x'] + $note->data['width'] / 2, $note->data['y'] + 20];

    $templatePage = $this->awaitRealtime($page->navigate($this->whiteboardPath($fromTemplate)));

    $templatePage->assertNotPresent($bar);

    $this->dragOnWhiteboard($templatePage, $middle, $middle, 1);

    $templatePage->assertPresent("{$bar} [role=\"radio\"][aria-label=\"Coral\"][aria-checked=\"true\"]")
        ->assertCount("{$bar} [role=\"radio\"][aria-checked=\"true\"]", 1);
});

it('[P18e-07-08] opens the board in read mode on a phone, switches to edit mode and back, has no toggle at 1440, and gives a guest of a locked board no toggle', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator();
    $toggle = '.whiteboard-canvas [data-slot="read-mode-toggle"]';
    $tools = '.whiteboard-canvas [role="toolbar"][aria-label="Tools"]';
    $scrollBack = '.whiteboard-canvas .scroll-back-to-content';
    $wheel = <<<'JS'
        async ([zooming, deltaY, steps]) => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.interactive');
            const box = canvas.getBoundingClientRect();

            // The canvas zooms around the last place of the pointer: an empty corner.
            canvas.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                clientX: box.right - 4,
                clientY: box.bottom - 4,
            }));
            await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));

            for (let step = 0; step < steps; step += 1) {
                canvas.dispatchEvent(new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    ctrlKey: zooming,
                    deltaX: 0,
                    deltaY,
                    clientX: box.right - 4,
                    clientY: box.bottom - 4,
                }));
                await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
            }

            return true;
        }
        JS;
    $dockIsClear = <<<'JS'
        (() => {
            const apart = (first, second) => first.bottom <= second.top || first.top >= second.bottom || first.right <= second.left || first.left >= second.right;
            const dock = document.querySelector('.whiteboard-canvas [data-slot="read-mode-toggle"]').getBoundingClientRect();
            const bar = document.querySelector('.whiteboard-reactions').getBoundingClientRect();
            const tools = document.querySelector('.whiteboard-canvas [data-slot="phone-toolbar"] [role="toolbar"]');

            return dock.width > 0 && dock.right <= window.innerWidth && apart(dock, bar) && (tools === null || apart(dock, tools.getBoundingClientRect()));
        })()
        JS;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $sticky = $this->addWhiteboardElement($page, $board, ['x' => 60, 'y' => 200, 'width' => 200, 'height' => 200]);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertPresent($tools)
        ->assertNotPresent($toggle)
        ->assertNotPresent('[data-slot="read-mode-state"]');

    $page->resize(390, 844);

    $page = $this->awaitRealtime($page->navigate($this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 1);

    $page->assertSeeIn('.whiteboard-canvas [data-slot="read-mode-state"]', 'Reading')
        ->assertSeeIn($toggle, 'Edit')
        ->assertNotPresent("{$toggle}[aria-pressed]")
        ->assertSeeIn('.whiteboard-canvas span[role="status"]', 'Reading')
        ->assertNotPresent($tools)
        ->assertNotPresent('button[aria-label="Sticky note"]')
        ->assertNotPresent('.whiteboard-canvas [role="toolbar"][aria-label="Selection"]')
        ->assertScript($dockIsClear, true)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true);

    $this->dragOnWhiteboard($page, [160, 300], [200, 420]);
    $this->settleWhiteboard($page);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->data)
        ->toMatchArray(['x' => $sticky['x'], 'y' => $sticky['y']]);

    $page->assertNotPresent($scrollBack);
    $page->script("() => ({$wheel})([true, -400, 30])");
    $page->assertPresent($scrollBack)
        ->click($scrollBack)
        ->assertNotPresent($scrollBack);
    $page->script("() => ({$wheel})([false, 1500, 12])");
    $page->assertPresent($scrollBack)
        ->assertScript($dockIsClear, true);

    $page = $this->awaitRealtime($page->navigate($this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($page, 1);

    $page->click($toggle)
        ->assertSeeIn($toggle, 'Read')
        ->assertNotPresent("{$toggle}[aria-pressed]")
        ->assertNotPresent('[data-slot="read-mode-state"]')
        ->assertScript('document.querySelector(\'.whiteboard-canvas span[role="status"]\').textContent', 'Editing')
        ->assertPresent($tools)
        ->assertScript($dockIsClear, true);

    $this->addWhiteboardSticky($page, 'Sky');
    $this->awaitWhiteboardStored($page, $board, 2);
    $this->awaitWhiteboardScene($page, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->where('author_member_id', $franMember->id)->latest('seq')->first()->data['backgroundColor'])
        ->toBe('#e2f3ff');

    $page->click($toggle)
        ->assertSeeIn($toggle, 'Edit')
        ->assertSeeIn('.whiteboard-canvas [data-slot="read-mode-state"]', 'Reading')
        ->assertNotPresent($tools)
        ->assertCount('[data-realtime]', 1);

    $page->resize(1440, 900)
        ->assertNotPresent($toggle)
        ->assertNotPresent('[data-slot="read-mode-state"]')
        ->assertPresent($tools);

    $board->update(['locked' => true]);

    $guestPage = $this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia');
    $guestPage->resize(390, 844);
    $guestPage = $this->awaitRealtime($guestPage->navigate($this->whiteboardPath($board)));
    $this->awaitWhiteboardElements($guestPage, 2);

    $guestPage->assertPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertNotPresent($toggle)
        ->assertNotPresent('[data-slot="read-mode-state"]')
        ->assertNotPresent($tools)
        ->assertNotPresent('button[aria-label="Sticky note"]');

    $this->dragOnWhiteboard($guestPage, [160, 300], [200, 420]);
    $this->settleWhiteboard($guestPage);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('element_id', $sticky['id'])->sole()->data)
        ->toMatchArray(['x' => $sticky['x'], 'y' => $sticky['y']]);

    $this->sendFromPage($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['locked' => false]);

    $guestPage->assertNotPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertSeeIn($toggle, 'Edit')
        ->click($toggle)
        ->assertSeeIn($toggle, 'Read')
        ->assertPresent($tools)
        ->assertNotPresent('.whiteboard-canvas .excalidraw--view-mode');

    $this->sendFromPage($page, 'PATCH', "/whiteboards/{$board->id}/settings", ['locked' => true]);

    $guestPage->assertPresent('div[role="status"]:has-text("This board is locked.")')
        ->assertNotPresent($toggle)
        ->assertNotPresent($tools)
        ->assertPresent('.whiteboard-canvas .excalidraw--view-mode');
});

it('[P18e-07-09] opens the header with the logo and the breadcrumb "team › Whiteboards › name", shows "Synced" and the viewer, and keeps the title on a phone', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $board->team->update(['name' => 'Atlas']);
    $crumbs = 'header nav[aria-label="Breadcrumb"]';
    $hidden = fn (string $selector): string => "getComputedStyle(document.querySelector('{$selector}')).display";
    // Whole, or cut after six rem at least: never down to a few letters.
    $titleKeepsItsRoom = "(({ scrollWidth, clientWidth }) => clientWidth > 0 && (scrollWidth <= clientWidth || clientWidth / parseFloat(getComputedStyle(document.documentElement).fontSize) >= 6))(document.querySelector('header h1'))";

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)))->resize(1440, 900);

    $franPage->assertPresent('header > a[data-slot="session-logo"][aria-label="Back to the team"]:first-child')
        ->assertNotPresent('[data-slot="sidebar"]')
        ->assertSeeIn("{$crumbs} li:nth-child(1) a", 'Atlas')
        ->assertSeeIn("{$crumbs} li:nth-child(2) a", 'Whiteboards')
        ->assertSeeIn('header span > h1', 'Sprint board')
        ->assertSeeIn('header [data-slot="session-synced"]', 'Synced')
        ->assertVisible('header > [data-slot="session-self"]:last-child [aria-label="Fran Facilitator"]')
        ->assertCount('[data-realtime]', 1)
        ->click("{$crumbs} li:nth-child(1) a")
        ->assertPathIs(route('teams.show', [$board->team->workspace, $board->team], absolute: false));

    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'))->resize(1440, 900);

    $guestPage->assertSeeIn($crumbs, 'Whiteboards')
        ->assertDontSeeIn('header', 'Atlas')
        ->assertNotPresent('header a')
        ->assertPresent('header > [data-slot="session-logo"]:first-child')
        ->assertSeeIn('header [data-slot="session-synced"]', 'Synced')
        ->assertVisible('header [data-slot="session-self"] [aria-label="Guest Gia (Guest)"]')
        ->resize(390, 844)
        ->assertScript($hidden($crumbs), 'none')
        ->assertScript($hidden('header [data-slot="session-synced"]'), 'none')
        ->assertScript($hidden('header [data-slot="session-self"]'), 'none')
        ->assertScript($titleKeepsItsRoom, true)
        ->assertCount('[data-realtime]', 1);
});
