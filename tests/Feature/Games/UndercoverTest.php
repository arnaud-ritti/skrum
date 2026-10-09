<?php

use App\Actions\Games\PresentGameRound;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Events\Games\GameRoundStarted;
use App\Events\Games\GameUndercoverChanged;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;

/** @return array<string, mixed> */
function undercoverTable(int $count = 5): array
{
    $room = GameRoom::factory()->game(GameKind::Undercover)->linkAccess()->create(['turn_seconds' => 15]);
    [$hostUser, $host] = gameRoomHost($room);
    $users = [$host->id => $hostUser];
    $players = [$host];
    for ($i = 1; $i < $count; $i++) {
        [$user, $player] = gameRoomMember($room);
        $users[$player->id] = $user;
        $players[] = $player;
    }
    Event::fake([GameRoundStarted::class, GameUndercoverChanged::class]);
    $response = test()->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => array_keys($users), 'undercover_count' => 1])->assertCreated();
    $round = GameRound::query()->findOrFail($response->json('round.id'));

    return compact('room', 'hostUser', 'host', 'users', 'players', 'round');
}

function undercoverAdvance(array $table): TestResponse
{
    RateLimiter::clear('game-play:'.$table['host']->id);

    return test()->actingAs($table['hostUser'])->postJson(route('games.rounds.undercover.advance', [$table['room'], $table['round']]), ['version' => $table['round']->fresh()->undercover_state['version']]);
}

function undercoverOpenVoting(array $table): void
{
    while ($table['round']->fresh()->undercover_state['stage'] !== 'voting') {
        undercoverAdvance($table)->assertOk();
    }
}

function undercoverVote(array $table, string $voter, string $candidate): TestResponse
{
    RateLimiter::clear('game-play:'.$voter);

    return test()->actingAs($table['users'][$voter])->putJson(route('games.rounds.undercover.vote', [$table['room'], $table['round']]), ['version' => $table['round']->fresh()->undercover_state['version'], 'choice' => $candidate]);
}

it('distributes secret words without revealing camps even to the host or broadcasts', function () {
    $table = undercoverTable();
    $state = $table['round']->undercover_state;
    expect(array_count_values($state['roles']))->toEqual(['civilian' => 4, 'undercover' => 1]);
    foreach ($table['players'] as $player) {
        $snapshot = $this->actingAs($table['users'][$player->id])->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json('round');
        expect($snapshot['undercover']['myWord'])->toBe($state['words'][$state['roles'][$player->id]])
            ->and($snapshot['turnEndsAt'])->toBeNull()
            ->and($snapshot['undercover'])->not->toHaveKeys(['roles', 'words']);
    }
    Event::assertDispatched(GameRoundStarted::class, function ($event) use ($state) {
        $json = json_encode($event->broadcastWith());

        return ! str_contains($json, $state['words']['civilian']) && ! str_contains($json, $state['words']['undercover']);
    });
    expect($table['round']->toArray())->not->toHaveKey('undercover_state');
    $this->actingAs($table['hostUser'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertNotFound();
    [, $late] = gameRoomMember($table['room']);
    expect(resolve(PresentGameRound::class)->handle($table['round'], $table['room'], $late)['undercover']['myWord'])->toBeNull();
});

it('validates the player count and requires a civilian majority', function () {
    $room = GameRoom::factory()->game(GameKind::Undercover)->create();
    [$user, $host] = gameRoomHost($room);
    $this->actingAs($user)->postJson(route('games.rounds.store', $room), ['turn_order' => [$host->id]])->assertUnprocessable();
    $table = undercoverTable(3);
    $this->actingAs($table['hostUser'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();
    $this->actingAs($table['hostUser'])->postJson(route('games.rounds.store', $table['room']), ['turn_order' => array_keys($table['users']), 'undercover_count' => 2])->assertUnprocessable();
});

it('requires host control for every stage and rejects stale transitions', function () {
    $table = undercoverTable();
    $otherId = array_keys($table['users'])[1];
    $route = route('games.rounds.undercover.advance', [$table['room'], $table['round']]);
    $this->actingAs($table['users'][$otherId])->postJson($route, ['version' => 1])->assertForbidden();
    undercoverAdvance($table)->assertOk();
    $this->actingAs($table['users'][$otherId])->postJson($route, ['version' => $table['round']->fresh()->undercover_state['version']])->assertForbidden();
    RateLimiter::clear('game-play:'.$table['host']->id);
    $this->actingAs($table['hostUser'])->postJson($route, ['version' => 1])->assertConflict();
    undercoverOpenVoting($table);
    RateLimiter::clear('game-play:'.$otherId);
    $this->actingAs($table['users'][$otherId])->postJson($route, ['version' => $table['round']->fresh()->undercover_state['version']])->assertForbidden();
    undercoverAdvance($table)->assertConflict();
    $this->actingAs($table['hostUser'])->postJson(route('games.rounds.store', $table['room']), ['turn_order' => array_keys($table['users'])])->assertConflict();
});

it('allows replacing and retracting secret votes and refuses self votes', function () {
    $table = undercoverTable();
    $ids = array_keys($table['users']);
    undercoverVote($table, $ids[0], $ids[1])->assertConflict();
    undercoverOpenVoting($table);
    undercoverVote($table, $ids[0], $ids[0])->assertUnprocessable();
    undercoverVote($table, $ids[0], $ids[1])->assertOk();
    undercoverVote($table, $ids[0], $ids[2])->assertOk();
    expect($table['round']->choices()->count())->toBe(1);
    $snapshot = $this->actingAs($table['users'][$ids[1]])->getJson(route('games.snapshot.show', $table['room']))->assertOk()->json('round.undercover');
    expect($snapshot['myVote'])->toBeNull()->and($snapshot['votedCount'])->toBe(1);
    RateLimiter::clear('game-play:'.$ids[0]);
    $this->actingAs($table['hostUser'])->deleteJson(route('games.rounds.undercover.retract', [$table['room'], $table['round']]), ['version' => $table['round']->fresh()->undercover_state['version']])->assertOk();
    expect($table['round']->choices()->count())->toBe(0);
});

it('repeats tied votes and rejects votes from previous ballots or outside the tied candidates', function () {
    $table = undercoverTable();
    $ids = array_keys($table['users']);
    undercoverOpenVoting($table);
    for ($repeat = 0; $repeat < 2; $repeat++) {
        undercoverVote($table, $ids[0], $ids[1])->assertOk();
        undercoverVote($table, $ids[1], $ids[0])->assertOk();
        $version = $table['round']->fresh()->undercover_state['version'];
        undercoverAdvance($table)->assertOk();
        expect($table['round']->choices()->count())->toBe(0)
            ->and($table['round']->fresh()->undercover_state['candidates'])->toEqualCanonicalizing([$ids[0], $ids[1]])
            ->and($table['round']->fresh()->undercover_state['eliminated'])->toBe([]);
        RateLimiter::clear('game-play:'.$ids[2]);
        $this->actingAs($table['users'][$ids[2]])->putJson(route('games.rounds.undercover.vote', [$table['room'], $table['round']]), ['version' => $version, 'choice' => $ids[0]])->assertConflict();
        undercoverVote($table, $ids[0], $ids[2])->assertUnprocessable();
    }
});

it('reveals only the eliminated camp and starts another cycle without that player', function () {
    $table = undercoverTable();
    $state = $table['round']->undercover_state;
    $civilian = array_search('civilian', $state['roles'], true);
    $voter = array_values(array_diff($state['order'], [$civilian]))[0];
    undercoverOpenVoting($table);
    undercoverVote($table, $voter, $civilian)->assertOk();
    undercoverAdvance($table)->assertOk()->assertJsonPath('ended', null);
    $fresh = $table['round']->fresh();
    expect($fresh->undercover_state['cycle'])->toBe(2)->and($fresh->turnOrder())->not->toContain($civilian);
    $public = resolve(PresentGameRound::class)->handle($fresh, $table['room'], null)['undercover'];
    expect($public['eliminated'])->toBe([['playerId' => $civilian, 'role' => 'civilian']])->and($public['myWord'])->toBeNull();
    undercoverOpenVoting($table);
    undercoverVote($table, $civilian, $voter)->assertForbidden();
    undercoverVote($table, $voter, $civilian)->assertUnprocessable();
});

it('awards every member of the winning camp exactly once and reveals the words', function (string $winner) {
    $table = undercoverTable(3);
    $state = $table['round']->undercover_state;
    $targetRole = $winner === 'civilian' ? 'undercover' : 'civilian';
    $target = array_search($targetRole, $state['roles'], true);
    $voter = array_values(array_diff($state['order'], [$target]))[0];
    undercoverOpenVoting($table);
    undercoverVote($table, $voter, $target)->assertOk();
    undercoverAdvance($table)->assertOk()->assertJsonPath('ended.undercoverResult.winner', $winner)->assertJsonPath('ended.undercoverResult.words', $state['words']);
    expect(GamePoint::query()->count())->toBe(3)->and((int) GamePoint::query()->sum('points'))->toBe($winner === 'civilian' ? 10 : 5);
    foreach (GamePoint::query()->get() as $point) {
        expect($point->is_win)->toBe($state['roles'][$point->player_id] === $winner);
    }
    undercoverAdvance($table)->assertConflict();
    expect(GamePoint::query()->count())->toBe(3);
    $this->actingAs($table['hostUser'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertOk()->assertJsonPath('undercoverResult.winner', $winner);
})->with(['civilian', 'undercover']);

it('ends without a winner or points when passed or timed out', function (bool $timeout) {
    $table = undercoverTable();
    if ($timeout) {
        $table['room']->update(['timer_ends_at' => now()->addSecond()]);
        $this->travel(2)->seconds();
        $this->actingAs($table['hostUser'])->getJson(route('games.snapshot.show', $table['room']))->assertOk()->assertJsonPath('round', null);
    } else {
        $this->actingAs($table['hostUser'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk()->assertJsonPath('ended.undercoverResult.winner', null);
    }
    expect(GamePoint::query()->sum('points'))->toBe(0)->and(GamePoint::query()->where('is_win', true)->count())->toBe(0)
        ->and($table['round']->fresh()->outcome)->toBe($timeout ? GameRoundOutcome::TimedOut : GameRoundOutcome::Passed);
})->with([true, false]);

it('keeps room boundaries and refuses an unrelated round or a late voter', function () {
    $table = undercoverTable();
    [, $late] = gameRoomMember($table['room']);
    $other = undercoverTable();
    $this->actingAs($table['hostUser'])->postJson(route('games.rounds.undercover.advance', [$table['room'], $other['round']]), ['version' => 1])->assertNotFound();
    undercoverOpenVoting($table);
    $this->actingAs($late->user)->putJson(route('games.rounds.undercover.vote', [$table['room'], $table['round']]), ['version' => $table['round']->fresh()->undercover_state['version'], 'choice' => $table['host']->id])->assertForbidden();
});

it('lets guests receive their own word and vote without learning the other word', function () {
    $table = undercoverTable(3);
    $guest = gameRoomGuest($table['room']);
    $this->actingAs($table['hostUser'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();
    $ids = [$table['host']->id, array_keys($table['users'])[1], $guest->id];
    $response = $this->actingAs($table['hostUser'])->postJson(route('games.rounds.store', $table['room']), ['turn_order' => $ids])->assertCreated();
    $table['round'] = GameRound::query()->findOrFail($response->json('round.id'));
    undercoverOpenVoting($table);
    resolve('auth')->forgetGuards();
    $this->withCredentials()->withCookies(gameGuestCookie($guest))->getJson(route('games.snapshot.show', $table['room']))->assertOk()->assertJsonPath('round.undercover.myWord', $table['round']->undercover_state['words'][$table['round']->undercover_state['roles'][$guest->id]]);
    resolve('auth')->forgetGuards();
    $this->withCredentials()->withCookies(gameGuestCookie($guest))->putJson(route('games.rounds.undercover.vote', [$table['room'], $table['round']]), ['version' => $table['round']->fresh()->undercover_state['version'], 'choice' => $table['host']->id])->assertOk();
    expect($table['round']->choices()->where('player_id', $guest->id)->value('choice'))->toBe($table['host']->id);
});

it('plays in an anonymous retro and publishes changes on its channel', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['icebreaker_game' => GameKind::Undercover, 'is_anonymous' => true]);
    [$hostUser] = retroFacilitator($retro);
    [$a] = retroMember($retro);
    [$b] = retroMember($retro);
    foreach ([$hostUser, $a, $b] as $user) {
        $this->actingAs($user)->getJson(route('retros.snapshot.show', $retro))->assertOk();
    }
    $room = GameRoom::query()->where('retro_id', $retro->id)->sole();
    Event::fake([GameUndercoverChanged::class]);
    $response = $this->actingAs($hostUser)->postJson(route('games.rounds.store', $room), ['turn_order' => $room->players()->pluck('id')->all()])->assertCreated();
    $round = GameRound::query()->findOrFail($response->json('round.id'));
    $this->actingAs($hostUser)->postJson(route('games.rounds.undercover.advance', [$room, $round]), ['version' => 1])->assertOk();
    Event::assertDispatched(GameUndercoverChanged::class, fn ($event) => $event->channelName === $room->broadcastChannel() && $event->broadcastWith() === ['roundId' => $round->id]);
    $retro->update(['phase' => RetroPhase::Writing]);
    RateLimiter::clear('game-play:'.$room->players()->where('participant_id', $retro->facilitator_participant_id)->sole()->id);
    $this->actingAs($hostUser)->postJson(route('games.rounds.undercover.advance', [$room, $round]), ['version' => 2])->assertForbidden();
});

it('scores eliminated members of the winning camp', function () {
    $table = undercoverTable();
    $state = $table['round']->undercover_state;
    $civilian = array_search('civilian', $state['roles'], true);
    $undercover = array_search('undercover', $state['roles'], true);
    $voter = array_values(array_diff($state['order'], [$civilian, $undercover]))[0];
    undercoverOpenVoting($table);
    undercoverVote($table, $voter, $civilian)->assertOk();
    undercoverAdvance($table)->assertOk();
    undercoverOpenVoting($table);
    undercoverVote($table, $voter, $undercover)->assertOk();
    undercoverAdvance($table)->assertOk()->assertJsonPath('ended.undercoverResult.winner', 'civilian');
    expect(GamePoint::query()->where('player_id', $civilian)->sole()->points)->toBe(5);
});

it('uses the default Undercover count for the group size and the words of the room locale', function (int $count, int $expected, string $locale) {
    $table = undercoverTable($count);
    $this->actingAs($table['hostUser'])->postJson(route('games.rounds.pass.store', [$table['room'], $table['round']]))->assertOk();
    $table['room']->update(['locale' => $locale]);
    $response = $this->actingAs($table['hostUser'])->postJson(route('games.rounds.store', $table['room']), ['turn_order' => array_keys($table['users'])])->assertCreated();
    $state = GameRound::query()->findOrFail($response->json('round.id'))->undercover_state;
    expect(count(array_filter($state['roles'], fn ($role) => $role === 'undercover')))->toBe($expected);
    $pairs = resolve(GameWordBook::class)->undercoverPairs($locale);
    expect([$state['words']['civilian'], $state['words']['undercover']])->toBeIn([...$pairs, ...array_map(array_reverse(...), $pairs)]);
})->with([[3, 1, 'fr'], [7, 2, 'es'], [11, 2, 'de'], [12, 3, 'en']]);

it('reveals an abandoned Undercover game without awarding points', function () {
    $table = undercoverTable();
    $this->actingAs($table['hostUser'])->putJson(route('games.game.update', $table['room']), ['game' => 'hangman'])->assertNoContent();
    $this->actingAs($table['hostUser'])->getJson(route('games.rounds.show', [$table['room'], $table['round']]))->assertOk()->assertJsonPath('outcome', 'abandoned')->assertJsonPath('undercoverResult.winner', null);
    expect(GamePoint::query()->count())->toBe(0);
});
