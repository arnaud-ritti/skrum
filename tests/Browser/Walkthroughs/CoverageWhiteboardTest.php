<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;

function cvwObserver(Team $team): User
{
    return renamedUser(teamMember($team, TeamRole::Observer), 'Noa Observer');
}

function cvwOtherWorkspaceUser(): User
{
    $stranger = renamedUser(User::factory()->create(), 'Sam Stranger');
    $workspace = Workspace::factory()->create();
    $workspace->members()->attach($stranger, ['role' => WorkspaceRole::Admin->value]);

    return $stranger;
}

it('sends a visitor of a board without guests to the login, and a visitor of a board with guests to the session-ended page', function () {
    ['board' => $board] = whiteboardWithFacilitator(['guest_access_enabled' => false]);

    visit($this->whiteboardPath($board))
        ->assertPathIs('/login');

    $board->update(['guest_access_enabled' => true]);

    visit($this->whiteboardPath($board))
        ->assertPathIs($this->whiteboardPath($board))
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.')
        ->assertNotPresent('[data-realtime]')
        ->assertDontSee('Sprint board');
});

it('refuses the board, its snapshot and its changes with 403 to a workspace admin of another workspace', function () {
    ['board' => $board] = whiteboardWithFacilitator(['guest_access_enabled' => false]);
    $stranger = cvwOtherWorkspaceUser();

    $page = $this->signIn($stranger, $this->whiteboardPath($board));

    $page->assertPresent(forbiddenPage())
        ->assertNotPresent('[data-realtime]')
        ->assertDontSee('Sprint board');

    $deltaStatus = $page->script("() => fetch('/whiteboards/{$board->id}/elements?since=0', { headers: { Accept: 'application/json' } }).then((response) => response.status)");

    expect(fn () => $this->whiteboardSnapshot($page, $board))->toThrow(RuntimeException::class, 'HTTP 403')
        ->and($deltaStatus)->toBe(403)
        ->and(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('user_id', $stranger->id)->exists())->toBeFalse();
});

it('shows an observer the board in read mode with "You are observing this session.", no tools and no Edit, and refuses the observer\'s writes', function () {
    ['board' => $board, 'franMember' => $franMember] = whiteboardWithFacilitator();
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => 'observed-note',
        'data' => sceneElement(['id' => 'observed-note', 'index' => 'a0']),
        'author_member_id' => $franMember->id,
        'seq' => 1,
    ]);
    Whiteboard::query()->whereKey($board->id)->update(['seq' => 1]);
    $noa = cvwObserver($board->team);

    $page = $this->awaitRealtime($this->signIn($noa, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($page, 1);

    $page->assertSeeIn('header span > h1', 'Sprint board')
        ->assertSeeIn('[data-slot="observer-notice"]', 'You are observing this session.')
        ->assertNotPresent('[data-slot="canvas-tools"]')
        ->assertNotPresent('[data-slot="read-mode-toggle"]')
        ->assertPresent('[data-slot="whiteboard-zoom-bar"]')
        ->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]');

    $write = $this->writeWhiteboardElements($page, $board, [sceneElement(['index' => 'a1'])]);

    expect($write['status'])->toBe(403)
        ->and($write['body']['message'])->toBe('Observers can follow this session but not take part.')
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(1);
});

it('sends a team member who opens the guest link, and a guest who opens it again, straight to the board, and shows the notice for a link whose guests were turned off', function () {
    ['board' => $board] = whiteboardWithFacilitator();
    [$mia] = whiteboardMember($board);
    renamedUser($mia, 'Mia Member');
    $joinPath = $this->whiteboardJoinPath($board);

    $this->awaitRealtime($this->signIn($mia, $joinPath))
        ->assertPathIs($this->whiteboardPath($board))
        ->assertSeeIn('header span > h1', 'Sprint board');

    $guestPage = $this->awaitRealtime($this->joinAsGuest($joinPath, 'Guest Gia'));

    $guestPage->navigate($joinPath)
        ->assertPathIs($this->whiteboardPath($board))
        ->assertPresent('header img[data-presence-id][alt="Guest Gia"]');

    expect(WhiteboardMember::query()->where('whiteboard_id', $board->id)->whereNull('user_id')->count())->toBe(1)
        ->and(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('user_id', $mia->id)->count())->toBe(1);

    $board->update(['guest_access_enabled' => false]);

    visit($joinPath)
        ->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name');
});

it('refuses the templates page with its whiteboard templates to a workspace admin of another workspace, and sends a visitor to the login', function () {
    $team = Team::factory()->create();
    $member = renamedUser(teamMember($team), 'Mia Member');
    WhiteboardTemplate::factory()->for($team->workspace)->create(['name' => 'Customer journey', 'created_by_user_id' => $member->id]);
    $templatesPath = route('workspaces.templates.index', $team->workspace, false);

    $this->signIn($member, $templatesPath)
        ->click('[role="tab"]:has-text("Whiteboard")')
        ->assertSee('Customer journey');

    $this->signIn(cvwOtherWorkspaceUser(), $templatesPath)
        ->assertPresent(forbiddenPage())
        ->assertDontSee('Customer journey');

    visit($templatesPath)->assertPathIs('/login');
});

it('opens a workspace admin outside the team on the board with the tools of a member', function () {
    ['board' => $board] = whiteboardWithFacilitator();
    $ada = renamedUser(workspaceManager($board->team->workspace), 'Ada Admin');

    $page = $this->awaitRealtime($this->signIn($ada, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($page, 0);

    $page->assertSeeIn('header span > h1', 'Sprint board')
        ->assertPresent('[data-slot="canvas-tools"] [data-slot="whiteboard-toolbar"]')
        ->assertNotPresent('[data-slot="observer-notice"]')
        ->assertPresent('header img[data-presence-id][alt="Ada Admin"]');

    $this->addWhiteboardSticky($page, 'Sky');
    $this->awaitWhiteboardStored($page, $board, 1);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole()->is_sticky)->toBeTrue();
});

it('opens the board on a phone with a back arrow, "Whiteboard · 1 online" under the name and the scene fitted to the screen', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator();
    $sticky = sceneElement([
        'id' => 'far-sticky',
        'x' => 3000,
        'y' => 3000,
        'width' => 200,
        'height' => 200,
        'backgroundColor' => '#fdf1c2',
        'strokeColor' => '#ddc362',
        'customData' => ['skrum' => ['kind' => 'sticky']],
    ]);
    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $sticky['id'],
        'type' => $sticky['type'],
        'data' => $sticky,
        'version' => $sticky['version'],
        'version_nonce' => $sticky['versionNonce'],
        'author_member_id' => $franMember->id,
        'is_sticky' => true,
        'seq' => 1,
    ]);
    Whiteboard::query()->whereKey($board->id)->update(['seq' => 1]);
    $centrePixel = <<<'JS'
        (() => {
            const canvas = document.querySelector('.whiteboard-canvas canvas.excalidraw__canvas.static');

            return [...canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data].join(',');
        })()
        JS;

    $page = $this->signIn($fran, '/dashboard')->resize(390, 844);
    $page->navigate($this->whiteboardPath($board));
    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertVisible('header > :first-child > a[data-slot="session-back"][aria-label="Back to the team"] .lucide-arrow-left')
        ->assertNotPresent('header [data-slot="session-logo"]')
        ->assertSeeIn('header [data-slot="session-subtitle"]', 'Whiteboard · 1 online')
        ->assertVisible('header [data-slot="presence-stack-avatars"] img[alt="Fran Facilitator"]')
        ->assertScript($centrePixel, '253,241,194,255');
});
