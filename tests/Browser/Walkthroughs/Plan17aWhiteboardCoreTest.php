<?php

use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Browser\Support\ReverbServer;

function p17aGuestMember(Whiteboard $board): WhiteboardMember
{
    return WhiteboardMember::query()->where('whiteboard_id', $board->id)->whereNull('user_id')->sole();
}

function p17aElementWrites(): string
{
    return "performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.endsWith('/elements') && new URL(entry.name).search === '').length";
}

function p17aDeltaFetched(): string
{
    return "performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)";
}

it('[P17a-01] creates a whiteboard from the team page, lands on it as its facilitator and finds it listed on the team page', function () {
    $team = Team::factory()->create();
    $fran = renamedUser(teamMember($team), 'Fran Facilitator');
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $page = $this->signIn($fran, $teamPath);

    $page->assertSee('No whiteboards yet.')
        ->click('New session')
        ->click('[role="dialog"] [role="radio"]:has-text("Whiteboard")')
        ->assertPresent('[role="dialog"] #whiteboard-title')
        ->assertPresent('[role="dialog"] [data-slot="whiteboard-template-gallery"] [role="radiogroup"] [role="radio"][aria-checked="true"]')
        ->fill('#whiteboard-title', 'Sprint planning board')
        ->click('[role="dialog"] button:has-text("Create & open")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'Sprint planning board')->sole();

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 0);

    $page->assertPathIs($this->whiteboardPath($board))
        ->assertSeeIn('header span > h1', 'Sprint planning board')
        ->assertPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertPresent('header img[data-presence-id][alt="Fran Facilitator"]');

    $snapshot = $this->whiteboardSnapshot($page, $board);

    expect($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['me']['name'])->toBe('Fran Facilitator')
        ->and($snapshot['board']['facilitatorMemberId'])->toBe($snapshot['me']['id'])
        ->and($snapshot['elements'])->toBeArray()->toBeEmpty()
        ->and($board->team_id)->toBe($team->id)
        ->and($board->facilitator->user_id)->toBe($fran->id);

    $page->click('a[aria-label="Back to the team"]')
        ->assertPathIs($teamPath)
        ->assertSeeIn("a[href=\"{$this->whiteboardPath($board)}\"]", 'Sprint planning board')
        ->assertSeeIn("a[href=\"{$this->whiteboardPath($board)}\"]", 'Facilitated by Fran Facilitator')
        ->assertDontSee('No whiteboards yet.');
});

it('[P17a-02a] shows a guest who joined through the guest link the sticky note a member adds, without a reload', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('header img[data-presence-id][alt="Fran Facilitator"]')
            ->assertPresent('header img[data-presence-id][alt="Guest Gia"]');

        $this->awaitWhiteboardElements($page, 0);
    }

    $guestPage->assertPathIs($this->whiteboardPath($board))
        ->assertNotPresent('a[aria-label="Back to the team"]')
        ->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]');

    $this->addWhiteboardSticky($franPage, 'Sun');

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $sticky = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();
    $received = $this->whiteboardElements($guestPage, $board);

    expect($sticky->is_sticky)->toBeTrue()
        ->and($sticky->type)->toBe('rectangle')
        ->and($sticky->author_member_id)->toBe($franMember->id)
        ->and($sticky->data['backgroundColor'])->toBe('#fdf1c2')
        ->and($sticky->data['strokeColor'])->toBe('#ddc362')
        ->and($received)->toHaveCount(1)
        ->and($received[0]['id'])->toBe($sticky->element_id)
        ->and($received[0]['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and(p17aGuestMember($board)->guest_name)->toBe('Guest Gia');
});

it('[P17a-04] keeps the scene over a reload of both pages and writes nothing while loading', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->addWhiteboardSticky($franPage, 'Sun');
    $this->awaitWhiteboardElements($guestPage, 1);
    $this->addWhiteboardSticky($franPage, 'Sky');
    $this->awaitWhiteboardElements($guestPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $seq = $board->fresh()->seq;
    $stamp = $this->whiteboardSceneStamp($board);

    foreach ([$franPage, $guestPage] as $page) {
        $page->navigate($this->whiteboardPath($board));

        $this->awaitRealtime($page);
        $this->awaitResync($page);

        $page->assertScript(p17aDeltaFetched(), true);
        $this->settleWhiteboard($page);

        $page->assertScript(p17aElementWrites(), 0)
            ->assertAttribute('[data-scene]', 'data-scene', $stamp)
            ->assertDontSee('Reconnecting…');
    }

    expect($board->fresh()->seq)->toBe($seq)
        ->and($this->whiteboardSceneStamp($board))->toBe($stamp)
        ->and(str_starts_with($stamp, '2:'))->toBeTrue();
});

it('[P17a-02b] shows the guest a shape, a connector and a freehand stroke the member draws on the canvas', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);

    $this->drawOnWhiteboard($franPage, 'rectangle', [450, 250], [650, 400]);
    $this->awaitWhiteboardElements($guestPage, 1);

    $this->drawOnWhiteboard($franPage, 'arrow', [720, 300], [920, 420]);
    $this->awaitWhiteboardElements($guestPage, 2);

    $this->drawOnWhiteboard($franPage, 'freedraw', [450, 500], [800, 620]);
    $this->awaitWhiteboardElements($guestPage, 3);

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $received = collect($this->whiteboardElements($guestPage, $board))->pluck('type')->sort()->values()->all();
    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->pluck('type')->sort()->values()->all();

    expect($received)->toBe(['arrow', 'freedraw', 'rectangle'])
        ->and($stored)->toBe(['arrow', 'freedraw', 'rectangle']);
});

it('[P17a-02c] shows the guest an image element whose file the board holds, and the guest page downloads the file', function () {
    Storage::fake();

    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $fileId = 'p17aImage0001';
    $path = "{$board->storageDirectory()}/{$fileId}";
    $bytes = base64_decode(WhiteboardPng);

    Storage::put($path, $bytes);
    WhiteboardFile::factory()->create([
        'whiteboard_id' => $board->id,
        'file_id' => $fileId,
        'path' => $path,
        'mime_type' => 'image/png',
        'size' => strlen($bytes),
    ]);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitWhiteboardElements($guestPage, 0);

    $image = $this->addWhiteboardElement($franPage, $board, [
        'type' => 'image',
        'x' => 500,
        'y' => 300,
        'width' => 120,
        'height' => 120,
        'strokeColor' => 'transparent',
        'fileId' => $fileId,
        'status' => 'saved',
        'scale' => [1, 1],
        'crop' => null,
    ]);

    $this->awaitWhiteboardElements($guestPage, 1);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    $guestPage->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('/files/{$fileId}') && entry.responseEnd > 0)", true);

    $filePath = route('whiteboards.files.show', [$board, $fileId], false);
    $download = $guestPage->script("() => fetch('{$filePath}').then((response) => response.blob().then((blob) => response.status + ' ' + blob.type + ' ' + blob.size))");
    $received = $this->whiteboardElements($guestPage, $board);

    expect($download)->toBe('200 image/png '.strlen($bytes))
        ->and($received)->toHaveCount(1)
        ->and($received[0]['id'])->toBe($image['id'])
        ->and($received[0]['fileId'])->toBe($fileId);
});

it('[P17a-03a] ends with the same position on both pages after the member and the guest drag the same note', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $note = $this->addWhiteboardElement($franPage, $board, [
        'x' => 600,
        'y' => 300,
        'width' => 200,
        'height' => 200,
        'backgroundColor' => '#a5d8ff',
        'roughness' => 0,
    ]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $this->dragOnWhiteboard($franPage, [700, 400], [860, 400]);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $afterFran = WhiteboardElement::query()->where('element_id', $note['id'])->sole();

    expect($afterFran->data['x'])->toEqualWithDelta(760, 2)
        ->and($afterFran->data['y'])->toEqualWithDelta(300, 2)
        ->and($afterFran->version)->toBeGreaterThan(1);

    $this->dragOnWhiteboard($guestPage, [860, 400], [860, 520]);
    $this->awaitWhiteboardScene($guestPage, $board);
    $this->awaitWhiteboardScene($franPage, $board);

    $afterGuest = WhiteboardElement::query()->where('element_id', $note['id'])->sole();
    $stamp = $this->whiteboardSceneStamp($board);

    expect($afterGuest->data['x'])->toEqualWithDelta(760, 2)
        ->and($afterGuest->data['y'])->toEqualWithDelta(420, 2)
        ->and($afterGuest->version)->toBeGreaterThan($afterFran->version)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(1);

    foreach ([$franPage, $guestPage] as $page) {
        $page->navigate($this->whiteboardPath($board));

        $this->awaitRealtime($page);

        $page->assertAttribute('[data-scene]', 'data-scene', $stamp);
    }
});

it('[P17a-03b] keeps one copy when both write the same note at the same version, and hands the late writer the copy that won', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $note = $this->addWhiteboardElement($franPage, $board, ['x' => 600, 'y' => 300]);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardElements($guestPage, 1);

    $first = $this->writeWhiteboardElements($franPage, $board, [[...$note, 'version' => 2, 'versionNonce' => 500, 'x' => 100]]);
    $second = $this->writeWhiteboardElements($guestPage, $board, [[...$note, 'version' => 2, 'versionNonce' => 100, 'x' => 900]]);
    $late = $this->writeWhiteboardElements($franPage, $board, [[...$note, 'version' => 2, 'versionNonce' => 700, 'x' => 50]]);

    expect($first['status'])->toBe(200)
        ->and($first['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($second['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($late['status'])->toBe(200)
        ->and($late['body']['rejected'])->toHaveCount(1)
        ->and($late['body']['rejected'][0]['reason'])->toBe('stale')
        ->and($late['body']['rejected'][0]['element']['x'])->toBe(900)
        ->and($late['body']['rejected'][0]['element']['versionNonce'])->toBe(100);

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    $stored = WhiteboardElement::query()->where('element_id', $note['id'])->sole();

    expect($stored->data['x'])->toBe(900)
        ->and($stored->version)->toBe(2)
        ->and($stored->version_nonce)->toBe(100)
        ->and($this->whiteboardSceneStamp($board))->toBe('1:2:100');

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertAttribute('[data-scene]', 'data-scene', '1:2:100');
    }
});

it('[P17a-05a] replays the edit a member made while the board could not be reached, and brings the guest\'s edit to the member meanwhile', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitResync($franPage);
    $this->blockWhiteboardRequests($franPage);

    $this->addWhiteboardSticky($franPage, 'Sun');

    $franPage->assertSee('Reconnecting…')
        ->assertScript('window.whiteboardBlocked.refused >= 1', true);

    $this->awaitWhiteboardElements($franPage, 1);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);

    $diamond = $this->addWhiteboardElement($guestPage, $board, ['type' => 'diamond', 'index' => 'a1', 'x' => 900, 'y' => 300]);

    $this->awaitWhiteboardElements($franPage, 2);
    $this->awaitWhiteboardElements($guestPage, 1);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->pluck('element_id')->all())->toBe([$diamond['id']]);

    $this->unblockWhiteboardRequests($franPage);

    $this->awaitWhiteboardElements($guestPage, 2);

    $franPage->assertDontSee('Reconnecting…');

    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($guestPage, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_sticky', true)->count())->toBe(1)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('type', 'diamond')->count())->toBe(1)
        ->and($this->whiteboardElements($guestPage, $board))->toHaveCount(2);
});

it('[P17a-06a] ends the guest\'s access and invalidates the guest link when the facilitator turns guest access off', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $joinPath = $this->whiteboardJoinPath($board);
    $guestSwitch = '#whiteboard-guest-access';
    $share = '[data-slot="share-dialog"]';

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($joinPath, 'Guest Gia'));

    $franPage->click('button[aria-label="Share"]')
        ->assertAriaAttribute($guestSwitch, 'checked', 'true')
        ->assertPresent("{$share} button:has-text(\"Create a new link\")")
        ->assertPresent("{$share} input[aria-label=\"Guest link\"]")
        ->assertPresent("{$share} button:has-text(\"Copy link\")")
        ->click($guestSwitch)
        ->assertSeeIn('[role="alertdialog"]', 'Guests on this board lose access.')
        ->click('[role="alertdialog"] button:has-text("Turn off guest access")');

    $guestPage->assertSee('Your access to this board has ended.')
        ->assertNotPresent('[data-realtime]');

    expect($board->fresh()->guest_access_enabled)->toBeFalse()
        ->and(fn () => $this->whiteboardSnapshot($guestPage, $board))->toThrow(RuntimeException::class, 'HTTP 403');

    $franPage->assertAriaAttribute($guestSwitch, 'checked', 'false')
        ->assertNotPresent("{$share} button:has-text(\"Create a new link\")")
        ->assertNotPresent("{$share} input[aria-label=\"Guest link\"]")
        ->assertNotPresent("{$share} button:has-text(\"Copy link\")");

    expect($this->whiteboardSnapshot($franPage, $board)['board']['guestAccessEnabled'])->toBeFalse();

    $visitorPage = visit($joinPath);

    $visitorPage->assertSee('This guest link is no longer valid.')
        ->assertNotPresent('#name');

    expect(WhiteboardMember::query()->where('whiteboard_id', $board->id)->whereNull('user_id')->count())->toBe(1);
});

it('[P17a-06b] refuses the board, its snapshot and a write to a signed-in user who is not in the team, with 403', function () {
    ['board' => $board] = whiteboardWithFacilitator(['guest_access_enabled' => false]);
    $oscar = renamedUser(User::factory()->create(), 'Oscar Outsider');
    $board->team->workspace->members()->attach($oscar, ['role' => WorkspaceRole::Member->value]);

    $page = $this->signIn($oscar, $this->whiteboardPath($board));

    $page->assertSee('403')
        ->assertNotPresent('[data-realtime]')
        ->assertDontSee('Sprint board');

    $write = $this->writeWhiteboardElements($page, $board, [sceneElement()]);

    expect(fn () => $this->whiteboardSnapshot($page, $board))->toThrow(RuntimeException::class, 'HTTP 403')
        ->and($write['status'])->toBe(403)
        ->and($write['body']['message'])->toBe('You no longer have access to this board.')
        ->and(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('user_id', $oscar->id)->count())->toBe(0)
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);
});

it('[P17a-07a] ends the guest\'s session when the facilitator replaces the guest link, kills the old link and lets a guest in with the new one', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $oldJoinPath = $this->whiteboardJoinPath($board);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($oldJoinPath, 'Guest Gia'));

    $franPage->click('button[aria-label="Share"]')
        ->click('[data-slot="share-dialog"] button:has-text("Create a new link")')
        ->click('[role="alertdialog"] button:has-text("Create a new link")');

    $guestPage->assertSee('Your access to this board has ended.')
        ->assertNotPresent('[data-realtime]');

    $newJoinPath = $this->whiteboardJoinPath($board);

    expect($newJoinPath)->not->toBe($oldJoinPath)
        ->and(p17aGuestMember($board)->guest_secret_hash)->toBeNull()
        ->and(fn () => $this->whiteboardSnapshot($guestPage, $board))->toThrow(RuntimeException::class, 'HTTP 403')
        ->and((string) $this->whiteboardSnapshot($franPage, $board)['board']['guestUrl'])->toEndWith($newJoinPath);

    $guestPage->navigate($this->whiteboardPath($board))
        ->assertSee('Your session has ended.')
        ->assertSee('Guests: ask the facilitator for the guest link.');

    $visitorPage = visit($oldJoinPath);

    $visitorPage->assertSee('This guest link is no longer valid.');

    $newGuestPage = $this->awaitRealtime($this->joinAsGuest($newJoinPath, 'Guest Gil'));

    $newGuestPage->assertPathIs($this->whiteboardPath($board))
        ->assertPresent('header img[data-presence-id][alt="Guest Gil"]');
});

it('[P17a-07b] shows the access-ended state on the next action of a guest whose link was replaced behind an open page', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->awaitResync($guestPage);

    Whiteboard::query()->whereKey($board->id)->update(['guest_token' => Str::random(40)]);
    WhiteboardMember::query()->whereKey(p17aGuestMember($board)->id)->update(['guest_secret_hash' => null]);

    $guestPage->assertPresent('[data-realtime="connected"]');

    $this->addWhiteboardSticky($guestPage, 'Moss');

    $guestPage->assertSee('Your access to this board has ended.')
        ->assertNotPresent('[data-realtime]')
        ->assertNotPresent('button[aria-label="Sticky note"]');

    $this->awaitWhiteboardElements($franPage, 0);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);
});

it('[P17a-08a] stores nothing forged: the author is the requester, unknown data and unsafe links are dropped, and invalid elements are refused next to a valid one', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator();
    [$mia, $miaMember] = whiteboardMember($board);
    renamedUser($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($board)));

    $answer = $this->writeWhiteboardElements($miaPage, $board, [
        sceneElement([
            'id' => 'p17aValid',
            'index' => 'a0',
            'authorMemberId' => $franMember->id,
            'author_member_id' => $franMember->id,
            'link' => 'javascript:alert(1)',
            'customData' => ['skrum' => ['kind' => 'sticky', 'owner' => $franMember->id], 'note' => 'forged'],
        ]),
        sceneElement(['id' => 'p17aFrame', 'index' => 'a1', 'type' => 'iframe', 'link' => 'https://example.com']),
        sceneElement(['id' => 'p17aLine', 'index' => 'a2', 'type' => 'line']),
        sceneElement(['id' => 'p17aHuge', 'index' => 'a3', 'version' => 2147483648]),
        sceneElement(['id' => 'p17aLock', 'index' => 'a4', 'locked' => true]),
    ]);

    $reasons = collect($answer['body']['rejected'])->pluck('reason', 'id')->all();

    expect($answer['status'])->toBe(200)
        ->and($reasons)->toBe(['p17aFrame' => 'invalid', 'p17aLine' => 'invalid', 'p17aHuge' => 'invalid', 'p17aLock' => 'locked']);

    $this->awaitWhiteboardElements($franPage, 1);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($miaPage, $board);

    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();
    $received = $this->whiteboardElements($franPage, $board);

    expect($stored->element_id)->toBe('p17aValid')
        ->and($stored->author_member_id)->toBe($miaMember->id)
        ->and($stored->data['link'])->toBeNull()
        ->and($stored->data['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($stored->data)->not->toHaveKey('authorMemberId')
        ->and($stored->data)->not->toHaveKey('author_member_id')
        ->and($received)->toHaveCount(1)
        ->and(json_encode($received))->not->toContain('javascript:')
        ->and(json_encode($received))->not->toContain('forged');
});

it('[P17a-09] shows no Library button, no canvas menu, no link in the board menu and no outbound link in the help dialog', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $page->assertScript("Array.from(document.querySelectorAll('.whiteboard-canvas .main-menu-trigger')).every((trigger) => trigger.getClientRects().length === 0)", true)
        ->assertScript("Array.from(document.querySelectorAll('.excalidraw .default-sidebar-trigger')).every((trigger) => getComputedStyle(trigger).display == 'none')", true)
        ->assertDontSee('Library');

    $this->openWhiteboardMenu($page);

    $page->assertSeeIn('[role="menu"]', 'Canvas help')
        ->assertNotPresent('[role="menu"] a[href]')
        ->click('[role="menu"] [role="menuitem"]:has-text("Canvas help")')
        ->assertPresent('.HelpDialog .HelpDialog__islands-container')
        ->assertScript("Array.from(document.querySelectorAll('.HelpDialog a[href]')).filter((link) => link.getClientRects().length > 0).length", 0)
        ->assertScript("Array.from(document.querySelectorAll('.HelpDialog__header')).every((header) => getComputedStyle(header).display == 'none')", true)
        ->assertScript("document.querySelector('.HelpDialog').innerText.includes('Keyboard shortcuts')", true)
        ->assertScript("document.querySelector('.HelpDialog').innerText.includes('Documentation')", false)
        ->assertScript("document.querySelector('.HelpDialog').innerText.toLowerCase().includes('excalidraw')", false);
});

it('[P17a-10] shows the reactions bar at the bottom centre to the member and the guest, and flies the guest\'s reactions on the member\'s page with the guest\'s name', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();
    $bar = '.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]';
    $placed = "(() => { const box = document.querySelector('.whiteboard-reactions').getBoundingClientRect(); return Math.abs(box.left + box.width / 2 - window.innerWidth / 2) < 2 && window.innerHeight - box.bottom > 0 && window.innerHeight - box.bottom < 40; })()";

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent($bar)
            ->assertCount("{$bar} [aria-label^=\"Send a reaction \"]", 6)
            ->assertScript($placed, true);
    }

    $guestPage->click('[aria-label="Send a reaction 👍"]');

    $franPage->assertSeeIn('.lr-overlay', '👍')
        ->assertSeeIn('.lr-overlay', 'Guest Gia');

    $guestPage->click('[aria-label="Send a reaction ❤️"]');

    $franPage->assertSeeIn('.lr-overlay', '❤️');
});

it('[P17a-11] refuses a new note on a full board, says so and takes the note off the canvas', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    resolve(WriteWhiteboardElements::class)->maxLiveElements = 1;

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->addWhiteboardSticky($page, 'Sun');
    $this->awaitWhiteboardStored($page, $board, 1);
    $this->awaitWhiteboardScene($page, $board);

    $this->addWhiteboardSticky($page, 'Sky');

    $page->assertSee('This board is full.');

    $this->awaitWhiteboardElements($page, 1);
    $this->awaitWhiteboardScene($page, $board);

    $stored = WhiteboardElement::query()->where('whiteboard_id', $board->id)->sole();

    expect($stored->data['backgroundColor'])->toBe('#fdf1c2')
        ->and($stored->data['strokeColor'])->toBe('#ddc362')
        ->and($this->whiteboardElements($page, $board))->toHaveCount(1);
});

it('[P17a-05b] shows the reconnecting banner while Reverb is down, still exchanges edits by polling, and clears the banner when Reverb is back', function () {
    ['board' => $board, 'fran' => $fran] = whiteboardWithFacilitator();

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertDontSee('Reconnecting…');
    }

    ReverbServer::stop();

    try {
        $franPage->assertSee('Reconnecting…');
        $guestPage->assertSee('Reconnecting…');

        $this->addWhiteboardSticky($franPage, 'Sun');
        $this->awaitWhiteboardElements($guestPage, 1);

        $this->addWhiteboardElement($guestPage, $board, ['type' => 'ellipse', 'x' => 900, 'y' => 300]);
        $this->awaitWhiteboardElements($franPage, 2);
        $this->awaitWhiteboardElements($guestPage, 2);

        $franPage->assertSee('Reconnecting…');
        $guestPage->assertSee('Reconnecting…');
    } finally {
        ReverbServer::start();
    }

    foreach ([$franPage, $guestPage] as $page) {
        $page->assertDontSee('Reconnecting…');

        $this->awaitRealtime($page);
        $this->awaitWhiteboardScene($page, $board);
    }

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(2);
});
