<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;

it('creates a standalone room with casts and defaults', function () {
    $room = GameRoom::factory()->create();

    expect($room->game)->toBe(GameKind::Hangman)
        ->and($room->access)->toBe(GameRoomAccess::Team)
        ->and($room->isIcebreaker())->toBeFalse()
        ->and($room->broadcastChannel())->toBe("game.{$room->id}")
        ->and($room->toArray())->not->toHaveKey('guest_token')
        ->and($room->guestUrl())->toBe(route('games.join.show', $room->guest_token));
});

it('gets empty lists from the model and hides the word', function () {
    $room = GameRoom::factory()->create();
    $round = activeGameRound($room, ['word' => 'sprint']);

    $fresh = $round->fresh();

    expect($fresh->revealed_positions)->toBeEmpty()
        ->and($fresh->picked_letters)->toBeEmpty()
        ->and($fresh->picked_by)->toBeEmpty()
        ->and($fresh->clue)->toBeEmpty()
        ->and($fresh->drawing)->toBeEmpty()
        ->and($fresh->misses)->toBe(0)
        ->and($fresh->isActive())->toBeTrue()
        ->and($fresh->toArray())->not->toHaveKeys(['word', 'picked_by'])
        ->and($room->fresh()->activeRound()?->id)->toBe($round->id);
});

it('has no active round once the current round ended', function () {
    $room = GameRoom::factory()->create();
    activeGameRound($room)->forceFill(['ended_at' => now(), 'outcome' => GameRoundOutcome::Passed])->save();

    expect($room->fresh()->activeRound())->toBeNull();
});

it('knows host, creator and managers of a standalone room', function () {
    $room = GameRoom::factory()->create();
    [$hostUser, $host] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $admin = workspaceManager($room->team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);
    $room->forceFill(['created_by_user_id' => $hostUser->id])->save();

    expect($room->isHost($host))->toBeTrue()
        ->and($room->isCreator($host))->toBeTrue()
        ->and($room->isManager($host))->toBeTrue()
        ->and($room->isManager($member))->toBeFalse()
        ->and($room->isManager($adminPlayer))->toBeTrue()
        ->and($room->isHost($adminPlayer))->toBeFalse();
});

it('uses the retro for icebreaker rooms', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => CarbonImmutable::parse('2026-10-06 10:05:00')]);
    [, $facilitator] = retroFacilitator($retro);
    [, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create(['timer_ends_at' => null]);
    $hostPlayer = GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);
    $player = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);

    expect($room->isIcebreaker())->toBeTrue()
        ->and($room->team_id)->toBe($retro->team_id)
        ->and($room->broadcastChannel())->toBe("retro.{$retro->id}")
        ->and($room->effectiveTimerEndsAt()?->toIso8601String())->toBe('2026-10-06T10:05:00+00:00')
        ->and($room->isHost($hostPlayer))->toBeTrue()
        ->and($room->isHost($player))->toBeFalse()
        ->and($player->presenceId())->toBe($participant->id)
        ->and($player->displayName())->toBe($participant->displayName())
        ->and($player->avatarUrl())->toBe($participant->avatarUrl())
        ->and($player->accountUserId())->toBe($participant->user_id);
});

it('names guest players and uses the player id as presence id', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = GamePlayer::factory()->guest()->create(['game_room_id' => $room->id, 'guest_name' => 'Happy Otter']);

    expect($guest->isGuest())->toBeTrue()
        ->and($guest->displayName())->toBe('Happy Otter')
        ->and($guest->presenceId())->toBe($guest->id)
        ->and($guest->accountUserId())->toBeNull()
        ->and($guest->toArray())->not->toHaveKey('guest_secret_hash');
});

it('shows former members once their user is deleted', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);

    $user->delete();

    expect($player->fresh()->displayName())->toBe(__('Former member'));
});

it('keeps points when their round is deleted and drops them with the room', function () {
    $room = GameRoom::factory()->create();
    [$user, $player] = gameRoomMember($room);
    $round = GameRound::factory()->ended()->create(['game_room_id' => $room->id]);
    $point = GamePoint::factory()->create([
        'team_id' => $room->team_id,
        'game_room_id' => $room->id,
        'game_round_id' => $round->id,
        'player_id' => $player->id,
        'user_id' => $user->id,
        'points' => 3,
    ]);

    $round->delete();

    expect($point->fresh()->game_round_id)->toBeNull();

    $room->delete();

    expect(GamePoint::query()->count())->toBe(0)
        ->and(GamePlayer::query()->count())->toBe(0);
});

it('casts the icebreaker game of a retro', function () {
    $retro = Retro::factory()->create();

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::DrawAndGuess);

    $retro->update(['icebreaker_game' => GameKind::Hangman]);

    expect($retro->fresh()->icebreaker_game)->toBe(GameKind::Hangman);
});

it('scopes game guest cookies', function () {
    expect(GuestCookie::name(GuestCookie::GameScope, 'room-id'))->toBe('game_guest_room-id');
});

it('lists a team game rooms', function () {
    $room = GameRoom::factory()->create();

    expect($room->team->gameRooms()->pluck('id')->all())->toBe([$room->id]);
});

it('labels every game kind and outcome', function () {
    expect(collect(GameKind::cases())->map->label()->all())
        ->toBe([
            __('Draw & Guess'), __('Sprint in one GIF'), __('Hangman'), __('Decoded'),
            __('Two truths and a lie'), __('Mood weather'), __('Guess who?'), __('Quick question'), __('Undercover'),
        ])
        ->and(GameRoundOutcome::TimedOut->value)->toBe('timed_out');
});
