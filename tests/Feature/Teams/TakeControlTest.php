<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use Illuminate\Testing\TestResponse;

/**
 * @return array{0: Retro, 1: User}
 */
function retroInProgress(Team $team, RetroPhase $phase = RetroPhase::Writing): array
{
    $retro = Retro::factory()->for($team)->create(['phase' => $phase]);
    [$facilitator] = retroFacilitator($retro);

    return [$retro, $facilitator];
}

function takeRetroControl(Retro $retro, User $user): TestResponse
{
    Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $user->id]);

    return test()->actingAs($user)->putJson(route('retros.facilitator.update', $retro), ['user_id' => $user->id]);
}

it('lets a team facilitator, a team owner and a workspace admin take control of an open retro', function (string $who) {
    $team = Team::factory()->create();
    [$retro] = retroInProgress($team);
    $taker = $who === 'admin' ? workspaceManager($team->workspace) : teamMember($team, TeamRole::from($who));

    takeRetroControl($retro, $taker)->assertNoContent();

    expect($retro->fresh()->facilitator->user_id)->toBe($taker->id);
})->with(['facilitator', 'owner', 'admin']);

it('refuses a retro take-over to a member, and to anyone on a completed retro', function () {
    $team = Team::factory()->create();
    [$open, $facilitator] = retroInProgress($team);
    [$closed] = retroInProgress($team, RetroPhase::Completed);

    takeRetroControl($open, teamMember($team))->assertForbidden();
    takeRetroControl($closed, teamMember($team, TeamRole::Facilitator))->assertForbidden();

    expect($open->fresh()->facilitator->user_id)->toBe($facilitator->id);
});

it('refuses to take control on behalf of someone else', function () {
    $team = Team::factory()->create();
    [$retro, $facilitator] = retroInProgress($team);
    $owner = teamMember($team, TeamRole::Owner);
    Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $owner->id]);

    $this->actingAs($owner)
        ->putJson(route('retros.facilitator.update', $retro), ['user_id' => teamMember($team)->id])
        ->assertForbidden();

    expect($retro->fresh()->facilitator->user_id)->toBe($facilitator->id);
});

it('refuses a take-over to an observer, with the observer message', function () {
    $team = Team::factory()->create();
    [$retro] = retroInProgress($team);

    takeRetroControl($retro, teamMember($team, TeamRole::Observer))
        ->assertForbidden()
        ->assertJsonPath('message', 'Observers can follow this session but not take part.');
});

it('keeps the hand-over of the current facilitator as it is', function () {
    $team = Team::factory()->create();
    [$retro, $facilitator] = retroInProgress($team);
    $member = teamMember($team);

    $this->actingAs($facilitator)
        ->putJson(route('retros.facilitator.update', $retro), ['user_id' => $member->id])
        ->assertNoContent();

    expect($retro->fresh()->facilitator->user_id)->toBe($member->id);
});

it('tells the retro snapshot who may take control', function (?TeamRole $role, bool $canTakeControl) {
    $team = Team::factory()->create();
    [$retro, $facilitator] = retroInProgress($team);
    $viewer = $role === null ? $facilitator : teamMember($team, $role);
    Participant::query()->firstOrCreate(['retro_id' => $retro->id, 'user_id' => $viewer->id]);

    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('viewer.canTakeControl', $canTakeControl);
})->with([
    'the facilitator themselves' => [null, false],
    'a team facilitator' => [TeamRole::Facilitator, true],
    'a team owner' => [TeamRole::Owner, true],
    'a member' => [TeamRole::Member, false],
    'an observer' => [TeamRole::Observer, false],
]);

it('lets a team facilitator take hosting of a game room, not a member, and gives neither the deletion', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->for($team)->create(['name' => 'Warm-up']);
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $member = teamMember($team);
    $facilitatorPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $facilitator->id]);
    $memberPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $member->id]);

    $this->actingAs($member)->putJson(route('games.host.update', $room), ['player_id' => $memberPlayer->id])->assertForbidden();

    $this->actingAs($facilitator)->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('room.canBecomeHost', true)
        ->assertJsonPath('room.canDelete', false);

    $this->actingAs($facilitator)->putJson(route('games.host.update', $room), ['player_id' => $facilitatorPlayer->id])->assertNoContent();

    expect($room->fresh()->host_player_id)->toBe($facilitatorPlayer->id);
});

it('keeps "Take control" of poker games and whiteboards for every member, and refuses it to observers', function () {
    $team = Team::factory()->create();
    $game = PokerGame::factory()->for($team)->create();
    $board = Whiteboard::factory()->for($team)->create();
    $member = teamMember($team);
    $observer = teamMember($team, TeamRole::Observer);

    $this->actingAs($member)->get(route('poker.show', $game))->assertOk();
    $this->actingAs($member)->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])->assertNoContent();

    $this->actingAs($member)->get(route('whiteboards.show', $board))->assertOk();
    $this->actingAs($member)->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $member->id])->assertNoContent();

    $this->actingAs($observer)->get(route('whiteboards.show', $board))->assertOk();
    $this->actingAs($observer)->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $observer->id])->assertForbidden();
});
