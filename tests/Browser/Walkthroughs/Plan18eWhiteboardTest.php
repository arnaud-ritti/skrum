<?php

use App\Models\User;
use App\Models\WhiteboardMember;

it('[P18e-07-01] prefills the name on the guest-join page, lets the visitor in with "Join", and shows the notice for an invalid link', function () {
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
        ->click('Join')
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

    $franPage->click('header span > h1 button')
        ->assertValue($field, 'Sprint board')
        ->fill($field, 'Not this name')
        ->keys($field, 'Escape')
        ->assertNotPresent($field)
        ->assertSeeIn('header span > h1', 'Sprint board');

    expect($board->fresh()->title)->toBe('Sprint board');

    $franPage->keys('header span > h1 button', 'F2')
        ->fill($field, 'Onboarding journey')
        ->keys($field, 'Enter')
        ->assertNotPresent($field)
        ->assertSeeIn('header span > h1', 'Onboarding journey');

    $guestPage->assertSeeIn('header span > h1', 'Onboarding journey')
        ->assertNotPresent('header span > h1 button');

    expect($board->fresh()->title)->toBe('Onboarding journey');

    $this->openWhiteboardMenu($franPage)
        ->assertPresent('[role="menuitem"]:has-text("Rename")');

    $franPage->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]')
        ->click('header button[aria-label="Export"]')
        ->assertSee('Download board data');

    $guestPage->click('header button[aria-label="Export"]')
        ->assertSee('Download board data');
});
