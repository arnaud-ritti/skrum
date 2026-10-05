<?php

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\FakeGameRules;

it('renders the games pages', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();
    $user = teamMember($team);
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);

    $this->actingAs($user)
        ->get(route('teams.games.index', ['workspace' => $team->workspace->slug, 'team' => $team->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('games/index')
            ->where('team', ['id' => $team->id, 'name' => $team->name])
            ->where('period', '30d')
            ->missing('rooms')
            ->missing('gameOptions')
            ->missing('canCreate')
            ->missing('roomLimit'));

    $this->actingAs($user)
        ->get(route('games.show', $room))
        ->assertInertia(fn (Assert $page) => $page->component('games/show'));

    resolve('auth')->forgetGuards();

    $this->get(route('games.join.show', $room->guest_token))
        ->assertInertia(fn (Assert $page) => $page->component('games/join'));
});

it('opens the team page and the games page its header links to', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)->get(route('teams.show', [$team->workspace, $team]))->assertOk();
    $this->actingAs($user)->get(route('teams.games.index', [$team->workspace, $team]))->assertOk();
});

it('marks a room with an active round as playing with the start of that round', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
    $round = GameRound::factory()->create(['game_room_id' => $room->id]);
    $room->update(['current_round_id' => $round->id]);

    $rooms = gameRoomSummaries($team);

    expect($rooms)->toHaveCount(1)
        ->and($rooms[0]['status'])->toBe('playing')
        ->and($rooms[0]['roundStartedAt'])->toBe($round->started_at->toIso8601String());
});

it('marks a room without an active round as waiting', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();
    GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
    $endedRoom = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
    $endedRound = GameRound::factory()->ended()->create(['game_room_id' => $endedRoom->id]);
    $endedRoom->update(['current_round_id' => $endedRound->id]);

    $rooms = gameRoomSummaries($team);

    expect($rooms)->toHaveCount(2)
        ->each(fn ($room) => $room->status->toBe('waiting')->roundStartedAt->toBeNull());
});

it('sends five players of a room and counts all of them', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();
    $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
    $players = collect(range(1, 7))->map(fn (int $index) => GamePlayer::factory()->create([
        'game_room_id' => $room->id,
        'created_at' => now()->subMinutes(10 - $index),
    ]));

    $rooms = gameRoomSummaries($team);

    expect($rooms[0]['playersCount'])->toBe(7)
        ->and($rooms[0]['players'])->toHaveCount(5)
        ->and(array_column($rooms[0]['players'], 'id'))->toBe($players->take(5)->pluck('id')->all())
        ->and(array_keys($rooms[0]['players'][0]))->toBe(['id', 'name', 'avatarUrl']);
});

it('does not grow the query count of the rooms list with the number of rooms', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman));
    $team = Team::factory()->create();

    $queriesFor = function () use ($team): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        gameRoomSummaries($team);
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    };

    $makeRoom = function () use ($team): void {
        $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id]);
        GamePlayer::factory()->count(3)->create(['game_room_id' => $room->id]);
        $round = GameRound::factory()->create(['game_room_id' => $room->id]);
        $room->update(['current_round_id' => $round->id]);
    };

    $makeRoom();
    gameRoomSummaries($team);
    $withOneRoom = $queriesFor();

    $makeRoom();
    $makeRoom();
    $makeRoom();

    expect($queriesFor())->toBe($withOneRoom);
});
