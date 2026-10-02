<?php

use App\Enums\PokerRevealReason;
use App\Enums\RetroPhase;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;

function p10bRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     game: PokerGame,
 *     ada: User,
 *     adaPlayer: PokerPlayer,
 *     bob: User,
 *     bobPlayer: PokerPlayer
 * }
 */
function p10bTable(array $attributes = []): array
{
    $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Sprint planning', ...$attributes]);
    [$ada, $adaPlayer] = pokerFacilitator($game);
    [$bob, $bobPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'ada' => p10bRenamed($ada, 'Ada'),
        'adaPlayer' => $adaPlayer,
        'bob' => p10bRenamed($bob, 'Bob'),
        'bobPlayer' => $bobPlayer,
    ];
}

function p10bJoinAsSpectator(PokerGame $game, string $name): mixed
{
    $page = visit(route('poker.join.show', $game->guest_token, false));

    $page->assertSee('Join as spectator')
        ->fill('name', $name)
        ->click('#spectator')
        ->assertAriaAttribute('#spectator', 'checked', 'true')
        ->click('Join')
        ->assertPathIs("/poker/{$game->id}");

    return $page;
}

/**
 * The values a deck card of the saved decks page shows, in order.
 */
function p10bDeckCardValues(string $name): string
{
    return 'Array.from(Array.from(document.querySelectorAll(\'[data-slot="deck-card"]\')).find((card) => card.querySelector("h2").textContent === "'.$name.'").querySelectorAll(\'[data-slot="deck-card-values"] li\')).map((chip) => chip.textContent).join(" ")';
}

function p10bOpenSettings(mixed $page): mixed
{
    return $page->click('button[aria-label="Game settings"][aria-expanded="false"]')
        ->assertPresent('button[aria-label="Game settings"][aria-expanded="true"]')
        ->assertSee('Game settings');
}

/**
 * Applies the changes of the open settings popover, which stays open, then closes it.
 */
function p10bApplySettings(mixed $page, int $changes): mixed
{
    return $page->click('[role="dialog"] button:has-text("Apply ('.$changes.')")')
        ->assertSee('No changes')
        ->click('[role="dialog"] button[aria-label="Close"]')
        ->assertPresent('button[aria-label="Game settings"][aria-expanded="false"]');
}

it('[P10b-01] saves a team deck, rejects a duplicate name and hides edit and delete from other members', function () {
    $team = Team::factory()->create();
    $ada = p10bRenamed(teamMember($team), 'Ada');
    $bob = p10bRenamed(teamMember($team), 'Bob');
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $a = $this->signIn($ada, $teamPath);

    $a->click('[aria-label="Planning poker actions"]')
        ->click('[role="menuitem"]:has-text("Saved decks")')
        ->assertPathEndsWith('/poker-decks')
        ->assertSee('No saved decks yet.')
        ->click('Create a deck')
        ->assertAriaAttribute('#deck-new-unknown', 'checked', 'true')
        ->assertAriaAttribute('#deck-new-coffee', 'checked', 'true')
        ->fill('#deck-new-name', 'Team scale')
        ->fill('#deck-new-cards', '1, 2, 3, 5, 8')
        ->click('Save')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Team scale')
        ->assertScript(p10bDeckCardValues('Team scale'), '1 2 3 5 8 ? ☕')
        ->assertPresent('[aria-label="Edit Team scale"]')
        ->assertSee('Create a deck')
        ->click('Create a deck')
        ->assertVisible('#deck-new-name')
        ->fill('#deck-new-name', 'team scale ')
        ->fill('#deck-new-cards', '1, 2')
        ->click('Save')
        ->assertSeeIn('[role="dialog"]', 'A deck with this name already exists.');

    expect(SavedPokerDeck::query()->count())->toBe(1);

    $b = $this->signIn($bob, $teamPath);

    $b->click('[aria-label="Planning poker actions"]')
        ->click('[role="menuitem"]:has-text("Saved decks")')
        ->assertPathEndsWith('/poker-decks')
        ->assertSeeIn('[data-slot="saved-decks-grid"]', 'Team scale')
        ->assertNotPresent('[aria-label="Edit Team scale"]')
        ->assertNotPresent('[aria-label="Delete Team scale"]');
});

it('[P10b-02a] creates a game from a saved deck and keeps its cards when the deck is edited', function () {
    $team = Team::factory()->create();
    $ada = p10bRenamed(teamMember($team), 'Ada');
    $deck = SavedPokerDeck::factory()->create([
        'team_id' => $team->id,
        'name' => 'Team scale',
        'cards' => ['1', '2', '3', '5', '8', '?', '☕'],
        'created_by_user_id' => $ada->id,
    ]);
    $teamPath = route('teams.show', [$team->workspace, $team], false);

    $page = $this->signIn($ada, $teamPath);

    $page->assertSee('New session')
        ->click('New session')
        ->click('[role="dialog"] [role="radio"]:has-text("Planning poker")')
        ->assertSeeIn('[aria-label="Deck"] [role="radio"]:has-text("Team scale")', 'Saved')
        ->click('[role="radio"]:has-text("Team scale")')
        ->assertAriaAttribute('[role="radio"]:has-text("Team scale")', 'checked', 'true')
        ->assertNotPresent('#new-poker-anonymous')
        ->assertAriaAttribute('#new-poker-auto-reveal', 'checked', 'false')
        ->click('Create & open')
        ->assertPathBeginsWith('/poker/')
        ->assertSee('Team scale');

    $game = PokerGame::query()->sole();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);

    expect($game->cards)->toBe(['1', '2', '3', '5', '8', '?', '☕'])
        ->and($game->deck_name)->toBe('Team scale')
        ->and($game->anonymous_votes)->toBeFalse()
        ->and($game->auto_reveal)->toBeFalse();

    $page->navigate($teamPath)
        ->click('[aria-label="Planning poker actions"]')
        ->click('[role="menuitem"]:has-text("Saved decks")')
        ->assertPathEndsWith('/poker-decks')
        ->assertPresent('[aria-label="Edit Team scale"]')
        ->click('[aria-label="Edit Team scale"]')
        ->assertVisible("#deck-{$deck->id}-cards")
        ->fill("#deck-{$deck->id}-cards", '13,')
        ->click('Save')
        ->assertNotPresent('[role="dialog"]')
        ->assertScript(p10bDeckCardValues('Team scale'), '1 2 3 5 8 13 ? ☕');

    expect($deck->fresh()->cards)->toContain('13');

    $page->navigate("/poker/{$game->id}")
        ->assertSee('Team scale')
        ->assertPresent('button[aria-label="Play 8"]')
        ->assertNotPresent('button[aria-label="Play 13"]');
});

it('[P10b-02b] keeps a game unchanged when its saved deck is deleted', function () {
    $cards = ['1', '2', '3', '5', '8', '?', '☕'];
    $game = PokerGame::factory()->customCards($cards)->create(['deck_name' => 'Team scale']);
    [$ada] = pokerFacilitator($game);
    p10bRenamed($ada, 'Ada');
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);
    SavedPokerDeck::factory()->create([
        'team_id' => $game->team_id,
        'name' => 'Team scale',
        'cards' => $cards,
        'created_by_user_id' => $ada->id,
    ]);

    $page = $this->signIn($ada, route('teams.show', [$game->team->workspace, $game->team], false));

    $page->click('[aria-label="Planning poker actions"]')
        ->click('[role="menuitem"]:has-text("Saved decks")')
        ->assertPathEndsWith('/poker-decks')
        ->assertPresent('[aria-label="Delete Team scale"]')
        ->click('[aria-label="Delete Team scale"]')
        ->assertSeeIn('[role="alertdialog"]', 'Games that use it keep their cards.')
        ->click('[role="alertdialog"] button:has-text("Delete deck")')
        ->assertSee('No saved decks yet.');

    expect(SavedPokerDeck::query()->count())->toBe(0);

    $page->navigate("/poker/{$game->id}")
        ->assertSee('Team scale')
        ->assertPresent('button[aria-label="Play 8"]');
});

it('[P10b-02c] offers saved decks to the facilitator only, never to a guest', function () {
    ['game' => $game, 'ada' => $ada] = p10bTable();
    SavedPokerDeck::factory()->create([
        'team_id' => $game->team_id,
        'name' => 'Team scale',
        'created_by_user_id' => $ada->id,
    ]);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $guest = $this->awaitRealtime($this->joinAsGuest(route('poker.join.show', $game->guest_token, false), 'Casey'));

    p10bOpenSettings($a)
        ->assertSeeIn('[aria-label="Deck"] [role="radio"]:has-text("Team scale")', 'Saved')
        ->assertSee('Manage decks');

    $guest->assertPresent('[aria-label="Language"]')
        ->assertNotPresent('[aria-label="Facilitator menu"]')
        ->assertDontSee('Team scale');
});

it('[P10b-03] lets a guest join as a spectator who watches without a hand', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['guest_access_enabled' => false]);
    openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $a->assertVisible('[aria-label="Share"]')
        ->click('[aria-label="Share"]')
        ->assertVisible('#poker-guest-link-access')
        ->click('#poker-guest-link-access')
        ->assertVisible('input[aria-label="Guest link"]');

    $joinPath = (string) parse_url($a->value('input[aria-label="Guest link"]'), PHP_URL_PATH);

    expect($joinPath)->toBe("/poker/join/{$game->guest_token}");

    $c = visit($joinPath);
    $c->assertSee('Join as spectator')
        ->fill('name', 'Casey')
        ->click('#spectator')
        ->assertAriaAttribute('#spectator', 'checked', 'true')
        ->click('Join')
        ->assertPathIs("/poker/{$game->id}");
    $this->awaitRealtime($c);

    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $casey = PokerPlayer::query()->where('guest_name', 'Casey')->sole();

    expect($casey->is_spectator)->toBeTrue();

    $c->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    $a->assertSeeIn('section[aria-label="Watching"]', 'Casey');

    $b->assertSeeIn('section[aria-label="Watching"]', 'Casey')
        ->assertEnabled('button[aria-label="Play 5"]')
        ->assertNotPresent('[role="img"][aria-label="Casey: Not voted yet"]');
});

it('[P10b-11a] lets the facilitator switch a player to spectator and back, and facilitate while watching', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $b->assertEnabled('button[aria-label="Play 3"]')
        ->click('button[aria-label="Play 3"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->click('[aria-label="Player options"]')
        ->assertSee('Make spectator')
        ->click('Make spectator')
        ->assertSeeIn('section[aria-label="Watching"]', 'Bob')
        ->assertNotPresent('[role="img"][aria-label="Bob: Voted"]');

    $b->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    expect($round->votes()->count())->toBe(0);

    $a->click('[aria-label="Player options"]')
        ->assertSee('Make player')
        ->click('Make player')
        ->assertPresent('[role="img"][aria-label="Bob: Not voted yet"]');

    $b->assertEnabled('button[aria-label="Play 5"]');

    $a->click('Watch only')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    $b->click('button[aria-label="Play 5"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->assertSee('Reveal cards')
        ->click('Reveal cards')
        ->assertPresent('[role="img"][aria-label="Bob: 5"]')
        ->assertSee('Validate 5')
        ->click('@poker-validate')
        ->assertSee('Estimate: 5')
        ->click('Re-vote')
        ->assertSee('Reveal cards')
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');
});

it('[P10b-11b] lets a player switch to watching, which withdraws the open vote, and back to playing', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    $b->assertEnabled('button[aria-label="Play 3"]')
        ->click('button[aria-label="Play 3"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    $b->click('Watch only')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertNotPresent('[role="group"][aria-label="Your cards"]');

    $a->assertSeeIn('section[aria-label="Watching"]', 'Bob')
        ->assertNotPresent('[role="img"][aria-label="Bob: Voted"]');

    expect($round->votes()->count())->toBe(0);

    $b->assertSee('Join the vote')
        ->click('Join the vote')
        ->assertEnabled('button[aria-label="Play 3"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Not voted yet"]');
});

it('[P10b-10a] reveals an anonymous round as values without names', function () {
    ['game' => $game, 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bob' => $bob, 'bobPlayer' => $bobPlayer] = p10bTable();
    $round = openPokerRound($game);
    pokerVote($round, $adaPlayer, '8');
    pokerVote($round, $bobPlayer, '8');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();
    $values = 'Array.from(document.querySelectorAll(\'section[aria-label="Anonymous votes"] [role="img"]\')).map((card) => card.textContent).join(",")';

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    p10bApplySettings(
        p10bOpenSettings($a)
            ->assertSee("With two voters, each can work out the other's vote from their own.")
            ->click('#poker-anonymous-votes')
            ->assertAriaAttribute('#poker-anonymous-votes', 'checked', 'true'),
        1,
    );

    $b->assertSee('Anonymous votes');

    $a->assertSee('Re-vote')
        ->click('Re-vote')
        ->assertEnabled('button[aria-label="Play 3"]')
        ->click('button[aria-label="Play 3"]');

    $b->assertEnabled('button[aria-label="Play 5"]')
        ->click('button[aria-label="Play 5"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->click('Reveal cards');

    foreach ([$a, $b] as $page) {
        $page->assertPresent('section[aria-label="Anonymous votes"]')
            ->assertScript($values, '3,5')
            ->assertPresent('[role="img"][aria-label="Ada: Voted"]')
            ->assertPresent('[role="img"][aria-label="Bob: Voted"]')
            ->assertNotPresent('[role="img"][aria-label="Ada: 3"]')
            ->assertNotPresent('[role="img"][aria-label="Bob: 5"]')
            ->assertSee('Average');
    }

    $a->assertSeeIn('[data-slot="poker-dock-status"]', 'Your card · 3')
        ->assertNotPresent('button[aria-label="Play 3"]');

    $b->assertSeeIn('[data-slot="poker-dock-status"]', 'Your card · 5')
        ->assertNotPresent('button[aria-label="Play 5"]');
});

it('[P10b-10b] keeps a revealed anonymous round anonymous in the history after anonymity is turned off', function () {
    ['game' => $game, 'ada' => $ada, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p10bTable(['anonymous_votes' => true]);
    $round = openPokerRound($game);
    pokerVote($round, $adaPlayer, '3');
    pokerVote($round, $bobPlayer, '5');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::Manual])->save();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $a->assertPresent('section[aria-label="Anonymous votes"]')
        ->assertAttribute('button:has-text("Rounds (1)")', 'aria-expanded', 'true')
        ->assertSee('3 × 1')
        ->assertSee('5 × 1')
        ->assertDontSee('Ada: 3')
        ->assertDontSee('Bob: 5');

    p10bApplySettings(
        p10bOpenSettings($a)
            ->click('#poker-anonymous-votes')
            ->assertSee('Applies from the next round.'),
        1,
    )
        ->assertScript('document.querySelector("header").textContent.includes("Anonymous votes")', false)
        ->assertPresent('section[aria-label="Anonymous votes"]')
        ->assertSee('3 × 1')
        ->assertDontSee('Bob: 5');

    expect($game->fresh()->anonymous_votes)->toBeFalse()
        ->and($round->fresh()->anonymous)->toBeTrue();
});

it('[P10b-12] shows the four switches to the facilitator and removes the cursor layer and the reactions bar for everyone when turned off', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent('[aria-label="Hide my cursor"]');
    }

    $b->assertNotPresent('[aria-label="Facilitator menu"]');

    p10bApplySettings(
        p10bOpenSettings($a)
            ->assertSee('Reveal automatically when everyone has voted or the timer ends')
            ->assertSee('Anonymous votes')
            ->assertSee('Show live cursors')
            ->assertSee('Show flying reactions')
            ->click('#poker-cursors')
            ->click('#poker-reactions'),
        2,
    );

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('[aria-label="Hide my cursor"]');
    }

    p10bApplySettings(
        p10bOpenSettings($a)
            ->assertAriaAttribute('#poker-cursors', 'checked', 'false')
            ->assertAriaAttribute('#poker-reactions', 'checked', 'false')
            ->click('#poker-cursors')
            ->click('#poker-reactions'),
        2,
    );

    foreach ([$a, $b] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent('[aria-label="Hide my cursor"]');
    }
});

it('[P10b-13] removes cursors, reactions and the watch toggle on an ended game and restores them on reopen', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertSee('Watch only');
    }

    $a->click('[aria-label="Facilitator menu"]')
        ->assertVisible('[role="menuitem"]:has-text("End game")')
        ->click('[role="menuitem"]:has-text("End game")')
        ->assertSee('End this game?')
        ->click('[role="alertdialog"] button:has-text("End game")');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Game ended')
            ->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertDontSee('Watch only')
            ->assertDisabled('button[aria-label="Play 5"]');
    }

    $a->click('[aria-label="Facilitator menu"]')
        ->assertVisible('[role="menuitem"]:has-text("Reopen game")')
        ->click('[role="menuitem"]:has-text("Reopen game")');

    foreach ([$a, $b] as $page) {
        $page->assertSee('Watch only')
            ->assertPresent('.lc-overlay')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertDontSee('Game ended');
    }
});

it('[P10b-15a] still shares named cursors and reactions on a retro board in Writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$ada] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    p10bRenamed($ada, 'Ada');
    p10bRenamed($bob, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $b->hover('No columns yet.')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('[P10b-15b] still hides cursors and keeps reactions on a retro board in Voting', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$ada] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    p10bRenamed($ada, 'Ada');
    p10bRenamed($bob, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('.lc-overlay');
    }

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');
});

it('[P10b-15c] still labels cursors "Participant" and sends unnamed reactions on an anonymous retro', function () {
    $retro = Retro::factory()->anonymous()->create();
    [$ada] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    p10bRenamed($ada, 'Ada');
    p10bRenamed($bob, 'Bob');

    $a = $this->awaitRealtime($this->signIn($ada, "/retros/{$retro->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $b->hover('No columns yet.')->hover('main.relative');
    $a->assertSeeIn('.lc-overlay', 'Participant');

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertPresent('.lr-reaction')
        ->assertNotPresent('.lr-label');
});

dataset('p10bLocales', [
    'fr' => ['fr', 'Français', 'Révélation automatique', 'Votes anonymes', 'Vous observez — passez en mode Jouer pour voter', 'Observateurs', 'Révélé automatiquement — tout le monde a voté', 'Minuteur', 'Arrêter le minuteur', "Menu de l'animateur", 'Paramètres…', 'Enregistré', 'Révéler automatiquement quand tout le monde a voté ou à la fin du minuteur'],
    'es' => ['es', 'Español', 'Revelado automático', 'Votos anónimos', 'Estás observando: cambia a Jugar para votar', 'Observando', 'Revelado automáticamente — todos votaron', 'Temporizador', 'Detener temporizador', 'Menú del facilitador', 'Ajustes…', 'Guardado', 'Revelar automáticamente cuando todos hayan votado o termine el temporizador'],
    'de' => ['de', 'Deutsch', 'Automatisch aufdecken', 'Anonyme Stimmen', 'Du schaust zu – wechsle zu Spielen, um abzustimmen', 'Zuschauer', 'Automatisch aufgedeckt — alle haben abgestimmt', 'Timer', 'Timer stoppen', 'Moderationsmenü', 'Einstellungen…', 'Gespeichert', 'Automatisch aufdecken, wenn alle abgestimmt haben oder der Timer abläuft'],
]);

it('[P10b-16a] translates the spectator, auto-reveal and anonymous strings after a guest switches language', function (string $locale, string $languageName, string $autoReveal, string $anonymousVotes, string $watchingNote, string $watching, string $revealedNote) {
    ['game' => $game, 'adaPlayer' => $adaPlayer, 'bobPlayer' => $bobPlayer] = p10bTable(['auto_reveal' => true, 'anonymous_votes' => true]);
    $round = openPokerRound($game);
    pokerVote($round, $adaPlayer, '3');
    pokerVote($round, $bobPlayer, '5');
    $round->forceFill(['revealed_at' => now(), 'reveal_reason' => PokerRevealReason::EveryoneVoted])->save();

    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    $c->assertSee('Auto-reveal')
        ->assertSee("You're watching — switch to Play to vote")
        ->assertSee('Revealed automatically — everyone voted')
        ->assertPresent('section[aria-label="Watching"]')
        ->assertPresent('section[aria-label="Anonymous votes"]')
        ->click('[aria-label="Language"]')
        ->assertVisible("[role=\"option\"]:has-text(\"{$languageName}\")")
        ->click("[role=\"option\"]:has-text(\"{$languageName}\")")
        ->assertSee($autoReveal)
        ->assertSee($anonymousVotes)
        ->assertSee($watchingNote)
        ->assertSee($revealedNote)
        ->assertPresent("section[aria-label=\"{$watching}\"]")
        ->assertPresent("section[aria-label=\"{$anonymousVotes}\"]")
        ->assertDontSee("You're watching — switch to Play to vote")
        ->assertDontSee('Revealed automatically — everyone voted')
        ->assertNotPresent('section[aria-label="Watching"]')
        ->assertNotPresent('section[aria-label="Anonymous votes"]');
})->with('p10bLocales');

it('[P10b-16b] translates the timer menu, the auto-reveal note and the saved decks for a facilitator in their language', function (string $locale, string $languageName, string $autoReveal, string $anonymousVotes, string $watchingNote, string $watching, string $revealedNote, string $timer, string $stopTimer, string $facilitatorMenu, string $settings, string $savedDeck, string $autoRevealNote) {
    ['game' => $game, 'ada' => $ada] = p10bTable(['auto_reveal' => true]);
    openPokerRound($game);
    SavedPokerDeck::factory()->create([
        'team_id' => $game->team_id,
        'name' => 'Team scale',
        'created_by_user_id' => $ada->id,
    ]);
    $ada->forceFill(['locale' => $locale])->save();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $a->assertSee($autoReveal)
        ->assertPresent("[aria-label=\"{$timer}\"]")
        ->click("[aria-label=\"{$timer}\"]")
        ->assertSeeIn('[role="menu"]', $stopTimer)
        ->assertDontSee('Stop timer')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]')
        ->click("[aria-label=\"{$facilitatorMenu}\"]")
        ->assertSee($settings)
        ->click($settings)
        ->assertSeeIn('[role="radio"]:has-text("Team scale")', $savedDeck)
        ->assertSee($autoRevealNote)
        ->assertDontSeeIn('[role="radio"]:has-text("Team scale")', 'Saved')
        ->assertDontSee('Reveal automatically when everyone has voted or the timer ends');
})->with('p10bLocales');

it('[P10b-04] shows named cursors between rounds and lets a player hide theirs', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertSee('Add the first task');
    }

    $a->hover('Add the first task')->hover('main button:has-text("Add task")');
    $b->assertSeeIn('.lc-overlay', 'Ada');

    $b->hover('Add the first task')->hover('main button:has-text("Add task")');
    $a->assertSeeIn('.lc-overlay', 'Bob');

    $a->click('[aria-label="Hide my cursor"]')
        ->assertAriaAttribute('[aria-label="Show my cursor"]', 'pressed', 'true');
    $b->assertNotPresent('.lc-cursor');

    $a->hover('Add the first task')
        ->hover('main button:has-text("Add task")')
        ->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada')
        ->assertNotPresent('.lc-cursor');

    $a->click('[aria-label="Show my cursor"]')
        ->assertAriaAttribute('[aria-label="Hide my cursor"]', 'pressed', 'false')
        ->hover('Add the first task')
        ->hover('main button:has-text("Add task")');
    $b->assertSeeIn('.lc-overlay', 'Ada');
});

it('[P10b-05] hides every cursor while a round is open and keeps reactions flying', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Checkout flow']);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]')
            ->assertPresent('.lc-overlay');
    }

    $a->hover('Pick a task to start voting');
    $b->assertSeeIn('.lc-overlay', 'Ada');

    $a->click('Checkout flow');

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="img"][aria-label="Ada: Not voted yet"]')
            ->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]');
    }

    $a->click('[aria-label="Send a reaction 🎉"]');
    $b->assertSeeIn('.lr-overlay', 'Ada');

    $b->click('[aria-label="Send a reaction 👏"]');
    $c->assertSeeIn('.lr-overlay', 'Bob');

    $c->click('[aria-label="Send a reaction 👍"]');
    $a->assertSeeIn('.lr-overlay', 'Casey');
});

it('[P10b-06] reveals by itself when the last online player votes, without waiting for a spectator', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent('.lc-overlay');
    }

    p10bApplySettings(
        p10bOpenSettings($a)
            ->click('#poker-auto-reveal')
            ->assertAriaAttribute('#poker-auto-reveal', 'checked', 'true'),
        1,
    );

    foreach ([$a, $b, $c] as $page) {
        $page->assertSee('Auto-reveal');
    }

    $a->assertEnabled('button[aria-label="Play 5"]')
        ->click('button[aria-label="Play 5"]');

    $b->assertPresent('[role="img"][aria-label="Ada: Voted"]')
        ->click('button[aria-label="Play 8"]');

    foreach ([$a, $b, $c] as $page) {
        $page->assertSee('Revealed automatically — everyone voted')
            ->assertPresent('[role="img"][aria-label="Ada: 5"]')
            ->assertPresent('[role="img"][aria-label="Bob: 8"]')
            ->assertPresent('.lc-overlay');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted)
        ->and($round->votes()->count())->toBe(2);
});

it('[P10b-07] reveals by itself when the only player who has not voted leaves the game', function () {
    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['auto_reveal' => true]);
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));
    $c = $this->awaitRealtime(p10bJoinAsSpectator($game, 'Casey'));

    foreach ([$a, $b, $c] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]');
    }

    $a->assertEnabled('button[aria-label="Play 5"]')
        ->click('button[aria-label="Play 5"]');

    $b->assertPresent('[role="img"][aria-label="Ada: Voted"]');

    expect($round->fresh()->revealed_at)->toBeNull();

    $b->click('[aria-label="Back to the team"]')
        ->assertPathBeginsWith('/w/');

    foreach ([$a, $c] as $page) {
        $page->assertSee('Revealed automatically — everyone voted')
            ->assertPresent('[role="img"][aria-label="Ada: 5"]');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::EveryoneVoted);

    $b->navigate("/poker/{$game->id}")
        ->assertSee('Revealed automatically — everyone voted');
});

it('[P10b-08a] counts a round timer down for everyone and reveals at zero when auto-reveal is on', function () {
    config(['queue.default' => 'database']);

    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['auto_reveal' => true]);
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertNotPresent('[role="timer"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $b->click('button[aria-label="Play 8"]');
    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$a, $b] as $page) {
        $page->assertSee("Revealed automatically — time's up")
            ->assertPresent('[role="img"][aria-label="Bob: 8"]')
            ->assertNotPresent('[role="timer"]');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Timer);
});

it('[P10b-08b] only shows "Time\'s up!" at zero when auto-reveal is off and leaves the round open until "Reveal cards"', function () {
    config(['queue.default' => 'database']);

    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable();
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $b->click('button[aria-label="Play 8"]');
    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    expect(DB::table('jobs')->count())->toBe(1);

    $this->travel(61)->seconds();
    $this->workQueue();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $this->awaitRealtime($a->navigate("/poker/{$game->id}"));
    $this->awaitRealtime($b->navigate("/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertAttribute('[role="timer"]', 'aria-label', "Time's up!")
            ->assertPresent('[role="img"][aria-label="Bob: Voted"]')
            ->assertDontSee('Revealed automatically');
    }

    $a->assertSee('Reveal cards')
        ->click('Reveal cards');

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="img"][aria-label="Bob: 8"]')
            ->assertDontSee('Revealed automatically');
    }

    expect($round->fresh()->reveal_reason)->toBe(PokerRevealReason::Manual);
});

it('[P10b-09] does not reveal at the original zero of a timer that was stopped', function () {
    config(['queue.default' => 'database']);

    ['game' => $game, 'ada' => $ada, 'bob' => $bob] = p10bTable(['auto_reveal' => true]);
    $round = openPokerRound($game);

    $a = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));
    $b = $this->awaitRealtime($this->signIn($bob, "/poker/{$game->id}"));

    foreach ([$a, $b] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $a->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$a, $b] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $b->click('button[aria-label="Play 8"]');

    $a->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Timer"]')
        ->assertSee('Stop timer')
        ->click('Stop timer');

    foreach ([$a, $b] as $page) {
        $page->assertNotPresent('[role="timer"]');
    }

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($round->fresh()->timer_ends_at)->toBeNull();

    $this->travel(61)->seconds();
    $this->workQueue();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and($round->fresh()->revealed_at)->toBeNull();

    $a->assertSee('Reveal cards')
        ->assertPresent('[role="img"][aria-label="Bob: Voted"]')
        ->assertDontSee('Revealed automatically');

    $b->assertEnabled('button[aria-label="Play 8"]')
        ->assertDontSee('Revealed automatically');
});
