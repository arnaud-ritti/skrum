<?php

use App\Enums\TeamRole;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;

const ObserverMessage = 'Observers can follow this session but not take part.';

/**
 * @return array{0: string, 1: string, 2: string} [write method, write url, snapshot url]
 */
function observedSession(Team $team, string $kind): array
{
    return match ($kind) {
        'retro' => (function () use ($team): array {
            $retro = Retro::factory()->for($team)->create();

            return ['postJson', route('retros.cards.store', $retro), route('retros.snapshot.show', $retro)];
        })(),
        'poker' => (function () use ($team): array {
            $game = PokerGame::factory()->for($team)->create();

            return ['postJson', route('poker.tasks.store', $game), route('poker.snapshot.show', $game)];
        })(),
        'whiteboard' => (function () use ($team): array {
            $board = Whiteboard::factory()->for($team)->create();

            return ['putJson', route('whiteboards.elements.update', $board), route('whiteboards.snapshot.show', $board)];
        })(),
        'game' => (function () use ($team): array {
            $room = GameRoom::factory()->for($team)->create(['name' => 'Warm-up']);

            return ['putJson', route('games.timer.update', $room), route('games.snapshot.show', $room)];
        })(),
        'survey' => (function () use ($team): array {
            $survey = TeamSurvey::factory()->for($team)->open()->create();

            return ['postJson', route('surveys.submission.store', $survey), route('surveys.snapshot.show', $survey)];
        })(),
    };
}

dataset('session kinds', ['retro', 'poker', 'whiteboard', 'game', 'survey']);

it('refuses every change an observer sends and lets them read', function (string $kind) {
    $team = Team::factory()->create();
    [$write, $url, $snapshot] = observedSession($team, $kind);
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($observer)->{$write}($url, [])
        ->assertForbidden()
        ->assertJsonPath('message', ObserverMessage);

    $this->actingAs($observer)->getJson($snapshot)
        ->assertOk()
        ->assertJsonPath('viewerIsObserver', true);
})->with('session kinds');

it('does not refuse a member, and tells them they are not an observer', function (string $kind) {
    $team = Team::factory()->create();
    [$write, $url, $snapshot] = observedSession($team, $kind);
    $member = teamMember($team);

    $response = $this->actingAs($member)->{$write}($url, []);

    expect($response->json('message'))->not->toBe(ObserverMessage);

    $this->actingAs($member)->getJson($snapshot)->assertJsonPath('viewerIsObserver', false);
})->with('session kinds');

it('never refuses a workspace admin whose team row says observer', function (string $kind) {
    $team = Team::factory()->create();
    [$write, $url] = observedSession($team, $kind);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);

    expect($this->actingAs($admin)->{$write}($url, [])->json('message'))->not->toBe(ObserverMessage);
})->with('session kinds');

it('lets a facilitator who became an observer keep driving the retro they facilitate', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create();
    [$user] = retroFacilitator($retro);
    $team->members()->updateExistingPivot($user->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($user)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertSuccessful();
});

it('leaves guests as they are', function () {
    $retro = Retro::factory()->create();
    $guest = retroGuest($retro);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('retros.cards.store', $retro), [])
        ->assertUnprocessable()
        ->assertJsonMissing(['message' => ObserverMessage]);
});

it('makes an observer a spectator when they open a poker game, withdrawing an open vote', function () {
    $team = Team::factory()->create();
    $game = PokerGame::factory()->for($team)->create();
    [$user, $player] = pokerMember($game);
    $round = openPokerRound($game);
    pokerVote($round, $player, '5');
    $team->members()->updateExistingPivot($user->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($user)->get(route('poker.show', $game))->assertOk();

    expect($player->fresh()->is_spectator)->toBeTrue()
        ->and($round->votes()->count())->toBe(0);
});

it('lets an observer join a poker game as a spectator', function () {
    $team = Team::factory()->create();
    $game = PokerGame::factory()->for($team)->create();
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($observer)->get(route('poker.show', $game))->assertOk();

    expect(PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $observer->id)->value('is_spectator'))->toBeTruthy();
});
