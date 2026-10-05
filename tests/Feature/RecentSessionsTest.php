<?php

use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @return array{0: User, 1: Team}
 */
function recentViewer(): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $user = teamMember($team);
    $user->forceFill(['current_workspace_id' => $team->workspace_id])->save();

    return [$user, $team];
}

/**
 * @return array<int, array<string, mixed>>
 */
function recentSessionsOf(User $user): array
{
    return test()->actingAs($user)->getJson(route('recentSessions.index'))->assertOk()->json('sessions');
}

it('lists the five sessions last touched in the teams the user can view in the current workspace', function () {
    [$user, $team] = recentViewer();
    $hiddenTeam = Team::factory()->for($team->workspace)->create();
    $elsewhere = Team::factory()->create();
    $elsewhere->workspace->members()->attach($user, ['role' => 'member']);
    $elsewhere->members()->attach($user);
    $touched = fn (int $hoursAgo): array => ['updated_at' => now()->subHours($hoursAgo)];

    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42', ...$touched(1)]);
    $game = PokerGame::factory()->for($team)->ended()->create(['title' => 'Estimates', ...$touched(2)]);
    $board = Whiteboard::factory()->for($team)->create(['title' => 'Roadmap', ...$touched(3)]);
    $room = GameRoom::factory()->for($team)->create(['name' => 'Friday room', ...$touched(4)]);
    $older = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41', ...$touched(5)]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 40', ...$touched(6)]);
    GameRoom::factory()->icebreaker($retro)->create($touched(0));
    Retro::factory()->for($hiddenTeam)->create(['title' => 'Hidden', ...$touched(0)]);
    Whiteboard::factory()->for($hiddenTeam)->create($touched(0));
    PokerGame::factory()->for($elsewhere)->create($touched(0));
    GameRoom::factory()->for($elsewhere)->create($touched(0));

    $sessions = recentSessionsOf($user);

    expect(array_column($sessions, 'id'))->toBe([$retro->id, $game->id, $board->id, $room->id, $older->id])
        ->and(array_column($sessions, 'kind'))->toBe(['retro', 'poker', 'whiteboard', 'game', 'retro'])
        ->and(array_column($sessions, 'url'))->toBe([
            route('retros.show', $retro),
            route('poker.show', $game),
            route('whiteboards.show', $board),
            route('games.show', $room),
            route('retros.show', $older),
        ])
        ->and($sessions[0])->toBe([
            'kind' => 'retro',
            'id' => $retro->id,
            'title' => 'Sprint 42',
            'team' => ['id' => $team->id, 'name' => 'Atlas'],
            'url' => route('retros.show', $retro),
            'updatedAt' => now()->subHour()->toIso8601String(),
            'live' => false,
        ]);
});

it('puts a live session first', function () {
    [$user, $team] = recentViewer();
    $minutesAgo = fn (int $minutes): array => ['updated_at' => now()->subMinutes($minutes)];

    $completed = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create($minutesAgo(1));
    $endedGame = PokerGame::factory()->for($team)->ended()->create($minutesAgo(2));
    $idleRoom = GameRoom::factory()->for($team)->create($minutesAgo(3));
    $liveRetro = Retro::factory()->for($team)->inPhase(RetroPhase::Voting)->create($minutesAgo(5));
    $liveGame = PokerGame::factory()->for($team)->create($minutesAgo(10));
    $liveRoom = GameRoom::factory()->for($team)->create();
    activeGameRound($liveRoom);
    $liveRoom->forceFill($minutesAgo(14))->save();
    $staleRetro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create($minutesAgo(16));

    foreach (range(1, 5) as $ignored) {
        Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create($minutesAgo(4));
    }

    $sessions = recentSessionsOf($user);

    expect(array_column($sessions, 'id'))->toBe([$liveRetro->id, $liveGame->id, $liveRoom->id, $completed->id, $endedGame->id])
        ->and(array_column($sessions, 'live'))->toBe([true, true, true, false, false])
        ->and(array_column($sessions, 'id'))->not->toContain($staleRetro->id)
        ->and(array_column($sessions, 'id'))->not->toContain($idleRoom->id);
});

it('gives nothing to a guest or an unverified user', function () {
    $this->get(route('recentSessions.index'))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->unverified()->create())->get(route('recentSessions.index'))->assertRedirect(route('verification.notice'));
});

it('is throttled', function () {
    [$user] = recentViewer();

    foreach (range(1, 60) as $attempt) {
        $this->actingAs($user)->getJson(route('recentSessions.index'))->assertOk();
    }

    $this->actingAs($user)->getJson(route('recentSessions.index'))->assertTooManyRequests();
});
