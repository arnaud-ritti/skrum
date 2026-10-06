<?php

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     room: GameRoom,
 *     ada: User,
 *     adaPlayer: GamePlayer
 * }
 */
function gamesFoundationRoom(array $attributes = []): array
{
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Lunch', ...$attributes]);
    [$ada, $adaPlayer] = gameRoomHost($room);

    $room->forceFill(['created_by_user_id' => $ada->id])->save();

    return [
        'room' => $room,
        'ada' => renamedUser($ada, 'Ada Host'),
        'adaPlayer' => $adaPlayer,
    ];
}

function gamesFoundationRoomPath(GameRoom $room): string
{
    return "/games/{$room->id}";
}

function gamesFoundationJoinPath(GameRoom $room): string
{
    return "/play/{$room->guest_token}";
}

function gamesFoundationSnapshotPath(GameRoom $room): string
{
    return "/games/{$room->id}/snapshot";
}

function gamesFoundationGuestPlayer(GameRoom $room, string $name): GamePlayer
{
    return GamePlayer::query()
        ->where('game_room_id', $room->id)
        ->where('guest_name', $name)
        ->sole();
}

function gamesFoundationMaskScript(): string
{
    return 'Array.from(document.querySelectorAll(\'[role="img"][data-slot="word-mask"] span\')).map((cell) => cell.textContent || "_").join("")';
}

it('creates a Hangman room open by link from the New session dialog', function () {
    $team = Team::factory()->create();
    $ada = renamedUser(teamMember($team), 'Ada Host');
    $games = '[role="dialog"] [role="radiogroup"][aria-label="Choose an icebreaker"]';

    $page = $this->signIn($ada, route('teams.show', [$team->workspace, $team], false));

    $page->click('[data-slot="team-header"] button:has-text("New session")')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Session type"] [role="radio"][data-type="icebreaker"]')
        ->assertVisible('#new-icebreaker-name')
        ->fill('#new-icebreaker-name', 'Lunch')
        ->click("{$games} [role=\"radio\"][data-game=\"hangman\"]")
        ->assertAttribute("{$games} [role=\"radio\"][data-game=\"hangman\"]", 'aria-checked', 'true')
        ->click('#new-icebreaker-access')
        ->assertVisible('[role="option"]:has-text("Anyone with the link")')
        ->click('[role="option"]:has-text("Anyone with the link")')
        ->assertSeeIn('#new-icebreaker-access', 'Anyone with the link')
        ->click('Create & open')
        ->assertPathBeginsWith('/games/');

    $room = GameRoom::query()->sole();

    $page->assertPathIs(gamesFoundationRoomPath($room))
        ->assertSeeIn('header:has(h1) h1', 'Lunch')
        ->assertSee('Ready to play?')
        ->assertButtonEnabled('Start')
        ->click('[aria-label="Invite"]')
        ->assertVisible('[data-slot="share-dialog"] button:has(span:text-is("Copy"))');

    expect($room->name)->toBe('Lunch')
        ->and($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Link)
        ->and($room->created_by_user_id)->toBe($ada->id)
        ->and($room->host->user_id)->toBe($ada->id);

    $page->navigate(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'icebreaker'], false))
        ->assertSeeIn('[data-slot="session-row"][data-kind="icebreaker"]', 'Lunch')
        ->assertSeeIn('[data-slot="session-row"][data-kind="icebreaker"]', 'Icebreaker · Hangman');
});

it('copies the guest link and lets a guest join under a suggested name', function () {
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom();

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));

    $host->click('[aria-label="Invite"]')
        ->assertVisible('[data-slot="share-dialog"] button:has(span:text-is("Copy"))');
    $host->script('() => { navigator.clipboard.writeText = (text) => { window.copiedGuestLink = text; return Promise.resolve(); }; return true; }');
    $host->click('[data-slot="share-dialog"] button:has(span:text-is("Copy"))')
        ->assertSee('Link copied')
        ->click('[data-slot="share-dialog"] button:has-text("Done")')
        ->assertNotPresent('[data-slot="share-dialog"]');

    $joinUrl = (string) $host->script('() => window.copiedGuestLink');

    expect($joinUrl)->toEndWith(gamesFoundationJoinPath($room));

    $guest = visit($joinUrl);

    $guest->assertSee('Lunch')
        ->assertSeeIn('[data-slot="guest-join-session"]', 'Hangman')
        ->assertSee('Your nickname')
        ->assertVisible('#name');

    [$adjective, $animal] = explode(' ', $guest->value('#name'));
    $names = require resource_path('games/guest-names/en.php');

    expect(array_column($names['adjectives'], 'n'))->toContain($adjective)
        ->and(array_column($names['animals'], 'name'))->toContain($animal);

    $guest->fill('#name', 'Visitor')
        ->click('Join the session')
        ->assertPathIs(gamesFoundationRoomPath($room));
    $this->awaitRealtime($guest);

    $guest->assertSeeIn('header:has(h1) h1', 'Lunch')
        ->assertSee('Waiting for the host to start.')
        ->assertSeeIn('section[aria-labelledby="game-players"]', 'Visitor')
        ->assertSeeIn('section[aria-labelledby="game-players"]', '(guest)')
        ->assertVisible('[aria-label="Language"]')
        ->assertNotPresent('[aria-label="Back to the team"]')
        ->assertNotPresent('[aria-label="Room menu"]')
        ->assertNotPresent('[aria-label="Invite"]');

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertPresent('img[data-presence-id][alt="Visitor"]')
        ->assertSeeIn('section[aria-labelledby="game-players"]', 'Visitor')
        ->assertVisible('[aria-label="Back to the team"]')
        ->assertNotPresent('[aria-label="Language"]');

    expect(gamesFoundationGuestPlayer($room, 'Visitor')->user_id)->toBeNull();
});

it('starts a round for both players and keeps the word out of the page source and the snapshot', function () {
    onlyGameWord('quartz');
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom();

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->assertSee('Ready to play?');
    $guest->assertSee('Waiting for the host to start.');

    $host->click('Start');

    foreach ([$host, $guest] as $page) {
        $page->assertCount('[role="group"][aria-label="Letters"] button', 26)
            ->assertPresent('[role="img"][aria-label="6 letters left to find"]')
            ->assertScript(gamesFoundationMaskScript(), '______')
            ->assertSee('0 of 6 misses');
    }

    expect(GameRound::query()->sole()->word)->toBe('quartz');

    foreach ([$host, $guest] as $page) {
        $snapshot = $this->snapshotOf($page, gamesFoundationSnapshotPath($room));

        expect($snapshot['round']['pickedLetters'])->toBeArray()->toBeEmpty()
            ->and($snapshot['round']['mask'])->toBe(array_fill(0, 6, null))
            ->and(gamePayloadExposesWord($snapshot, 'quartz'))->toBeFalse()
            ->and(gamePayloadExposesWord($page->content(), 'quartz'))->toBeFalse();

        $this->awaitRealtime($page->navigate(gamesFoundationRoomPath($room)));

        $page->assertScript(gamesFoundationMaskScript(), '______');

        expect(gamePayloadExposesWord($page->content(), 'quartz'))->toBeFalse();
    }
});

it('shows hits, misses, the figure and the last picks live to both players', function () {
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom();
    $round = activeGameRound($room, ['word' => 'quartz']);

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    $host->assertEnabled(letterKey('q'))
        ->click(letterKey('q'));

    foreach ([$host, $guest] as $page) {
        $page->assertScript(gamesFoundationMaskScript(), 'q_____')
            ->assertAriaAttribute(letterKey('q'), 'pressed', 'true')
            ->assertDisabled(letterKey('q'))
            ->assertSeeIn('[aria-label="Last moves"]', 'Ada Host picked Q')
            ->assertCount('svg[role="img"][aria-label="0 of 6 misses"] > *', 4);
    }

    $guest->assertEnabled(letterKey('x'))
        ->click(letterKey('x'));

    foreach ([$host, $guest] as $page) {
        $page->assertSee('1 of 6 misses')
            ->assertCount('svg[role="img"][aria-label="1 of 6 misses"] > *', 5)
            ->assertSeeIn('[aria-label="Last moves"]', 'Visitor picked X')
            ->assertDisabled(letterKey('x'))
            ->assertScript(gamesFoundationMaskScript(), 'q_____');
    }

    $guest->assertEnabled(letterKey('u'))
        ->click(letterKey('u'));

    foreach ([$host, $guest] as $page) {
        $page->assertScript(gamesFoundationMaskScript(), 'qu____')
            ->assertPresent('[role="img"][aria-label="4 letters left to find"]')
            ->assertSeeIn('[aria-label="Last moves"]', 'Visitor picked U')
            ->assertSee('1 of 6 misses');
    }

    expect($round->fresh()->picked_letters)->toBe(['q', 'x', 'u'])
        ->and($round->fresh()->misses)->toBe(1);
});

it('tells a player with a toast that a letter was already picked', function () {
    ['room' => $room, 'adaPlayer' => $adaPlayer] = gamesFoundationRoom();
    $round = activeGameRound($room, ['word' => 'quartz']);

    $guest = $this->awaitResync($this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor')));

    $guest->assertEnabled(letterKey('q'))
        ->assertScript(gamesFoundationMaskScript(), '______');

    $round->forceFill([
        'picked_letters' => ['q'],
        'picked_by' => [$adaPlayer->id],
        'revealed_positions' => [0],
    ])->save();

    $guest->click(letterKey('q'))
        ->assertSee('This letter was already picked.')
        ->assertScript(gamesFoundationMaskScript(), 'q_____')
        ->assertDisabled(letterKey('q'));

    expect($round->fresh()->picked_letters)->toBe(['q'])
        ->and($round->fresh()->misses)->toBe(0);
});

it('shows the solved word, the winner and the round in the history to both players', function () {
    ['room' => $room, 'ada' => $ada, 'adaPlayer' => $adaPlayer] = gamesFoundationRoom();
    $round = activeGameRound($room, [
        'word' => 'quartz',
        'picked_letters' => ['q', 'u', 'a', 'r', 't'],
        'picked_by' => array_fill(0, 5, $adaPlayer->id),
        'revealed_positions' => [0, 1, 2, 3, 4],
    ]);

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    $host->assertScript(gamesFoundationMaskScript(), 'quart_');

    $guest->assertScript(gamesFoundationMaskScript(), 'quart_')
        ->assertEnabled(letterKey('z'))
        ->click(letterKey('z'));

    foreach ([$host, $guest] as $page) {
        $page->assertSee('Solved')
            ->assertSee('quartz')
            ->assertSee('Visitor found it!')
            ->assertSeeIn('[aria-label="Points of this round"]', '+6 Visitor')
            ->assertSeeIn('[aria-label="Points of this round"]', '+5 Ada Host')
            ->assertPresent('aside li:has-text("Visitor") [aria-label="Winner"]')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    $host->assertSee('Next round');
    $guest->assertSee('Waiting for the host to start.');

    $host->click('History')
        ->assertSee('Last rounds')
        ->assertVisible('[role="dialog"] li button:has-text("quartz")')
        ->assertSeeIn('[role="dialog"] li button:has-text("quartz")', 'Solved')
        ->click('[role="dialog"] li button:has-text("quartz")')
        ->assertSeeIn('[role="dialog"]', 'Visitor found it!')
        ->assertPresent('[role="dialog"] [role="img"][aria-label="0 letters left to find"]')
        ->assertSeeIn('[role="dialog"]', 'Letters tried: Q U A R T Z');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Solved)
        ->and($round->fresh()->winner_player_id)->toBe(gamesFoundationGuestPlayer($room, 'Visitor')->id);
});

it('ends a round as "Time\'s up" when the one-minute timer of the host runs out', function () {
    config(['queue.default' => 'database']);
    onlyGameWord('quartz');
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom();

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Timer"]')
        ->assertVisible('[role="menuitem"]:text-is("1 min")')
        ->click('[role="menuitem"]:text-is("1 min")');

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('header:has(h1)', '0:');
    }

    expect(DB::table('jobs')->count())->toBe(0);

    $host->assertNotPresent('[role="menu"]')
        ->click('Start');

    foreach ([$host, $guest] as $page) {
        $page->assertCount('[role="group"][aria-label="Letters"] button', 26);
    }

    $round = GameRound::query()->sole();

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->ended_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('main [data-slot="badge"]', "Time's up")
            ->assertSee('quartz')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    $host->assertSee('Next round');
    $guest->assertSee('Waiting for the host to start.');

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut)
        ->and(DB::table('jobs')->count())->toBe(0);
});

it('ends an expired round on the next request when no queue worker runs', function () {
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom(['timer_ends_at' => now()->addMinute()->startOfSecond()]);
    $round = activeGameRound($room, ['word' => 'quartz']);

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    foreach ([$host, $guest] as $page) {
        $page->assertCount('[role="group"][aria-label="Letters"] button', 26);
    }

    $this->travel(61)->seconds();

    expect($round->fresh()->ended_at)->toBeNull();

    $this->awaitRealtime($host->navigate(gamesFoundationRoomPath($room)));

    foreach ([$host, $guest] as $page) {
        $page->assertSeeIn('main [data-slot="badge"]', "Time's up")
            ->assertSee('quartz')
            ->assertNotPresent('[role="group"][aria-label="Letters"]');
    }

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('renames the room and ends the access of guests when it becomes team-only', function () {
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom();

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Room menu"]')
        ->assertVisible('[role="menuitem"]:has-text("Room settings")')
        ->click('[role="menuitem"]:has-text("Room settings")')
        ->assertVisible('#room-name')
        ->assertValue('#room-name', 'Lunch')
        ->fill('#room-name', 'Lunch break')
        ->click('#room-access')
        ->assertVisible('[role="option"]:has-text("Team members only")')
        ->click('[role="option"]:has-text("Team members only")')
        ->assertSee('Guests in this room lose access.')
        ->click('Save')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn('header:has(h1) h1', 'Lunch break')
        ->click('[aria-label="Invite"]')
        ->assertSeeIn('[data-slot="share-dialog"]', 'Guest link is off')
        ->assertNotPresent('[data-slot="share-dialog"] button:has(span:text-is("Copy"))');

    $guest->assertSee('Your access to this room has ended.')
        ->assertDontSee('Back to the team')
        ->assertNotPresent('header:has(h1) h1');

    $host->assertPresent('[role="group"][aria-label="1 online"]');

    $guest->navigate(gamesFoundationRoomPath($room))
        ->assertPathIs('/login');

    visit(gamesFoundationJoinPath($room))->assertSee('This guest link is no longer valid.');

    expect($room->fresh()->name)->toBe('Lunch break')
        ->and($room->fresh()->access)->toBe(GameRoomAccess::Team);
});

it('deletes the room, sends its creator to the team page and tells the guest', function () {
    ['room' => $room, 'ada' => $ada] = gamesFoundationRoom();
    $teamPath = route('teams.show', [$room->team->workspace, $room->team], false);

    $host = $this->awaitRealtime($this->signIn($ada, gamesFoundationRoomPath($room)));
    $guest = $this->awaitRealtime($this->joinAsGuest(gamesFoundationJoinPath($room), 'Visitor'));

    $host->assertPresent('[role="group"][aria-label="2 online"]')
        ->click('[aria-label="Room menu"]')
        ->assertVisible('[role="menuitem"]:has-text("Delete room")')
        ->click('[role="menuitem"]:has-text("Delete room")')
        ->assertSee('Delete this room?')
        ->assertSee('Its rounds and scores are deleted for everyone.')
        ->click('[role="alertdialog"] button:has-text("Delete")');

    $host->assertPathIs($teamPath);

    $guest->assertSee('This room was deleted.')
        ->assertDontSee('Back to the team');

    expect(GameRoom::query()->whereKey($room->id)->exists())->toBeFalse();
});
