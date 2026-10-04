<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Events\Games\GameRoundEnded;
use App\Events\Games\GameRoundStarted;
use App\Jobs\CloseExpiredGameRound;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Tests\Support\SqlProbe;

/**
 * @return array{0: Retro, 1: User, 2: GameRoom}
 */
function hangmanIcebreaker(array $attributes = []): array
{
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create([
        'icebreaker_game' => GameKind::Hangman,
        ...$attributes,
    ]);
    [$facilitator] = retroFacilitator($retro);

    return [$retro, $facilitator, resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh())];
}

it('creates the icebreaker room when the retro enters the phase', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Writing)->create(['icebreaker_game' => GameKind::Hangman]);
    [$facilitator, $participant] = retroFacilitator($retro);
    $facilitator->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($facilitator)
        ->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])
        ->assertOk();

    $room = GameRoom::query()->where('retro_id', $retro->id)->sole();

    expect($room->game)->toBe(GameKind::Hangman)
        ->and($room->locale)->toBe('fr')
        ->and($room->team_id)->toBe($retro->team_id)
        ->and($room->name)->toBeNull()
        ->and($room->players()->where('participant_id', $participant->id)->exists())->toBeTrue();
});

it('creates the room lazily from the board snapshot, once', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $memberSnapshot = $this->actingAs($member)->getJson(route('retros.snapshot.show', $retro))->assertOk()->json();
    $facilitatorSnapshot = $this->actingAs($facilitator)->getJson(route('retros.snapshot.show', $retro))->assertOk()->json();

    expect(GameRoom::query()->where('retro_id', $retro->id)->count())->toBe(1)
        ->and($memberSnapshot['icebreaker']['room']['id'])->toBe($facilitatorSnapshot['icebreaker']['room']['id'])
        ->and($memberSnapshot['icebreaker']['room']['isIcebreaker'])->toBeTrue()
        ->and($memberSnapshot['icebreaker']['room']['isHost'])->toBeFalse()
        ->and($memberSnapshot['icebreaker']['room']['hostPlayerId'])->not->toBeNull()
        ->and($facilitatorSnapshot['icebreaker']['room']['isHost'])->toBeTrue()
        ->and($memberSnapshot['retro']['icebreakerGame'])->toBe('draw')
        ->and(collect($memberSnapshot['icebreakerGames'])->pluck('value')->all())->toBe(['draw', 'gif', 'hangman', 'decoded', 'two_truths', 'mood', 'guess_who', 'quick_question']);
});

it('sends no icebreaker outside the phase and never deletes the room', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $retro->update(['phase' => RetroPhase::Writing]);

    $this->actingAs($facilitator)
        ->patchJson(route('retros.settings.update', $retro), ['icebreaker_enabled' => false])
        ->assertNoContent();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker', null);

    expect($room->fresh())->not->toBeNull();
});

it('lets guests of the retro play the icebreaker', function () {
    [$retro, , $room] = hangmanIcebreaker(['guest_access_enabled' => true]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('icebreaker.room.id', $room->id)
        ->assertJsonPath('icebreaker.me.isGuest', true);

    expect(GamePlayer::query()->where('game_room_id', $room->id)->where('participant_id', $guest->id)->exists())->toBeTrue();
});

it('makes the current facilitator the host', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    [$member, $memberParticipant] = retroMember($retro);

    $retro->forceFill(['facilitator_participant_id' => $memberParticipant->id])->save();

    $this->actingAs($member)
        ->getJson(route('games.snapshot.show', $room))
        ->assertJsonPath('room.isHost', true);
    $this->actingAs($facilitator)
        ->postJson(route('games.rounds.store', $room))
        ->assertForbidden();
    $memberPlayer = $room->players()->where('participant_id', $memberParticipant->id)->sole();

    $this->actingAs($member)
        ->postJson(route('games.rounds.store', $room), ['turn_order' => [$memberPlayer->id]])
        ->assertCreated();
});

it('broadcasts icebreaker rounds on the retro channel', function () {
    Event::fake([GameRoundStarted::class]);
    [$retro, $facilitator, $room] = hangmanIcebreaker();

    $hostPlayer = $room->players()->sole();

    $this->actingAs($facilitator)->postJson(route('games.rounds.store', $room), ['turn_order' => [$hostPlayer->id]])->assertCreated();

    Event::assertDispatched(fn (GameRoundStarted $event) => $event->broadcastOn()->name === "presence-retro.{$retro->id}");
});

it('refuses game mutations on a completed retro and keeps the history readable', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    GameRound::factory()->ended(GameRoundOutcome::Solved)->create(['game_room_id' => $room->id]);
    $retro->update(['phase' => RetroPhase::Completed]);

    $this->actingAs($facilitator)
        ->postJson(route('games.rounds.store', $room))
        ->assertForbidden()
        ->assertJsonPath('message', 'The game can only be played during the icebreaker.');
    $this->actingAs($facilitator)
        ->getJson(route('games.rounds.index', $room))
        ->assertOk()
        ->assertJsonCount(1);
});

it('abandons the active round when the retro leaves the icebreaker', function () {
    Event::fake([GameRoundEnded::class]);
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $player = $room->players()->sole();
    $round = activeGameRound($room, [
        'picked_letters' => ['s'],
        'picked_by' => [$player->id],
        'revealed_positions' => [0],
    ]);

    $this->actingAs($facilitator)
        ->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])
        ->assertOk();

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::Abandoned)
        ->and($round->fresh()->ended_at)->not->toBeNull()
        ->and(GamePoint::query()->count())->toBe(0);

    Event::assertDispatched(fn (GameRoundEnded $event) => $event->payload['outcome'] === 'abandoned'
        && $event->broadcastOn()->name === "presence-retro.{$retro->id}");
});

it('resumes the same room without a round when the retro comes back', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    activeGameRound($room);

    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'writing'])->assertOk();
    $this->actingAs($facilitator)->putJson(route('retros.phase.update', $retro), ['phase' => 'icebreaker'])->assertOk();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker.room.id', $room->id)
        ->assertJsonPath('icebreaker.round', null)
        ->assertJsonPath('icebreaker.history.0.outcome', 'abandoned');
});

it('schedules the round expiry when the facilitator sets the board timer', function () {
    Queue::fake();
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $round = activeGameRound($room);

    $this->actingAs($facilitator)
        ->putJson(route('retros.timer.update', $retro), ['seconds' => 60])
        ->assertOk();

    $endsAt = $retro->fresh()->timer_ends_at;

    expect($endsAt->micro)->toBe(0);
    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && CarbonImmutable::parse($job->timerEndsAt)->equalTo($endsAt));
});

it('locks the retro then the icebreaker room when the board timer changes', function () {
    Queue::fake();
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    activeGameRound($room);

    $lockedTables = SqlProbe::lockedTables(fn () => $this->actingAs($facilitator)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk());

    expect($lockedTables)->toBe(['retros', 'game_rooms']);
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('schedules nothing outside the icebreaker', function () {
    Queue::fake();
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    activeGameRound($room);
    $retro->update(['phase' => RetroPhase::Writing]);

    $this->actingAs($facilitator)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();

    Queue::assertNotPushed(CloseExpiredGameRound::class);
});

it('ends the icebreaker round lazily when the board timer runs out', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker();
    $round = activeGameRound($room, ['started_at' => now()->startOfSecond()]);
    $retro->update(['timer_ends_at' => now()->addMinute()->startOfSecond()]);

    $this->travel(2)->minutes();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker.round', null);

    expect($round->fresh()->outcome)->toBe(GameRoundOutcome::TimedOut);
});

it('ignores a board timer that ran out before the round started', function () {
    [$retro, $facilitator, $room] = hangmanIcebreaker(['timer_ends_at' => now()->subMinute()->startOfSecond()]);
    $round = activeGameRound($room, ['started_at' => now()->startOfSecond()]);

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreaker.round.id', $round->id);

    expect($round->fresh()->isActive())->toBeTrue();
});

it('deletes the icebreaker room and its points with the retro', function () {
    [$retro, , $room] = hangmanIcebreaker();
    $player = $room->players()->sole();
    GamePoint::factory()->create(['team_id' => $room->team_id, 'game_room_id' => $room->id, 'player_id' => $player->id, 'points' => 4]);

    $retro->delete();

    expect(GameRoom::query()->whereKey($room->id)->exists())->toBeFalse()
        ->and(GamePoint::query()->count())->toBe(0);
});

it('offers the GIF game only with a GIF provider', function () {
    config(['services.gifs.key' => null]);
    [$retro, $facilitator] = hangmanIcebreaker();

    $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('icebreakerGames.1', ['value' => 'gif', 'label' => 'Sprint in one GIF', 'available' => false])
        ->assertJsonPath('icebreakerGames.2.available', true);
});

it('refuses the reactions setting on an icebreaker room, which uses the bar of its retro', function () {
    [, $facilitator, $room] = hangmanIcebreaker();

    $this->actingAs($facilitator)
        ->patchJson(route('games.update', $room), ['reactions_enabled' => false])
        ->assertUnprocessable();

    expect($room->fresh()->reactions_enabled)->toBeTrue();
});

it('tells an observer of the team they observe the icebreaker', function () {
    [$retro] = hangmanIcebreaker();
    [$observer] = retroMember($retro);
    $retro->team->members()->updateExistingPivot($observer->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($observer)->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('icebreaker.viewerIsObserver', true);
});
