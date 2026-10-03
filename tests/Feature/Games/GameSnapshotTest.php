<?php

use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\PresentGameRoundHistory;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeGameRules;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
    bindGameRules(new FakeGameRules);
});

it('builds the room for its host', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Friday fun', 'locale' => 'fr']);
    [$user, $host] = gameRoomHost($room);
    $room->forceFill(['created_by_user_id' => $user->id])->save();

    $snapshot = gameSnapshotFor($room, $host);

    expect($snapshot['room'])->toBe([
        'id' => $room->id,
        'name' => 'Friday fun',
        'game' => 'hangman',
        'locale' => 'fr',
        'access' => 'link',
        'reactionsEnabled' => true,
        'settings' => [
            'wordThemes' => [],
            'turnSeconds' => null,
            'autoHints' => false,
            'takesTurns' => false,
            'roundsPerGame' => null,
            'gifVotes' => 1,
            'gifAuthorsHidden' => false,
        ],
        'timerEndsAt' => null,
        'isHost' => true,
        'canManage' => true,
        'canDelete' => true,
        'canBecomeHost' => false,
        'hostPlayerId' => $host->id,
        'guestUrl' => route('games.join.show', $room->guest_token),
        'isIcebreaker' => false,
        'currentRoundId' => null,
        'teamName' => $room->team->name,
    ])
        ->and($snapshot['me'])->toBe(['playerId' => $host->id, 'userId' => $user->id, 'isGuest' => false])
        ->and($snapshot['players'])->toBe([[
            'id' => $host->id,
            'presenceId' => $host->id,
            'name' => $user->name,
            'avatarUrl' => $host->avatarUrl(),
            'isGuest' => false,
        ]])
        ->and($snapshot['round'])->toBeNull()
        ->and($snapshot['history'])->toBe([])
        ->and($snapshot['links'])->toBe(['team' => route('teams.show', [$room->team->workspace, $room->team]), 'retro' => null])
        ->and($snapshot['serverTime'])->toBe('2026-10-06T10:00:00.000Z');
});

it('tells the players whether reactions are on', function () {
    $room = GameRoom::factory()->create(['reactions_enabled' => false]);
    [, $host] = gameRoomHost($room);

    expect(gameSnapshotFor($room, $host)['room']['reactionsEnabled'])->toBeFalse();
});

it('hides management data from members and team data from guests', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $guest = gameRoomGuest($room);

    $memberSnapshot = gameSnapshotFor($room, $member);
    $guestSnapshot = gameSnapshotFor($room, $guest);

    expect($memberSnapshot['room']['canManage'])->toBeFalse()
        ->and($memberSnapshot['room']['canDelete'])->toBeFalse()
        ->and($memberSnapshot['room']['canBecomeHost'])->toBeFalse()
        ->and($memberSnapshot['room']['guestUrl'])->toBeNull()
        ->and($memberSnapshot['links']['team'])->not->toBeNull()
        ->and($guestSnapshot['me']['isGuest'])->toBeTrue()
        ->and($guestSnapshot['room']['guestUrl'])->toBeNull()
        ->and($guestSnapshot['room']['canBecomeHost'])->toBeFalse()
        ->and($guestSnapshot['links']['team'])->toBeNull();
});

it('lets workspace admins delete and take hosting', function () {
    $room = GameRoom::factory()->create();
    gameRoomHost($room);
    $admin = workspaceManager($room->team->workspace);
    $adminPlayer = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);

    $snapshot = gameSnapshotFor($room, $adminPlayer);

    expect($snapshot['room']['canManage'])->toBeTrue()
        ->and($snapshot['room']['canDelete'])->toBeTrue()
        ->and($snapshot['room']['canBecomeHost'])->toBeTrue()
        ->and($snapshot['room']['isHost'])->toBeFalse();
});

it('lists the games with registered rules, with their availability, in the order of the kinds', function () {
    bindGameRules(new FakeGameRules(kind: GameKind::Hangman), new FakeGameRules(kind: GameKind::SprintGif, available: false));
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);

    expect(gameSnapshotFor($room, $host)['games'])->toBe([
        ['value' => 'gif', 'label' => __('Sprint in one GIF'), 'available' => false],
        ['value' => 'hangman', 'label' => __('Hangman'), 'available' => true],
    ]);
});

it('presents the active round for the viewer through the rules', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    [, $member] = gameRoomMember($room);
    $round = activeGameRound($room, ['word' => 'secret']);

    $snapshot = gameSnapshotFor($room, $member);

    expect($snapshot['round'])->toBe([
        'id' => $round->id,
        'game' => 'hangman',
        'leaderPlayerId' => null,
        'startedAt' => '2026-10-06T10:00:00+00:00',
        'revealedAt' => null,
        'number' => null,
        'roundsTotal' => null,
        'turnOrder' => [],
        'turnPlayerId' => null,
        'turnEndsAt' => null,
        'turnSeconds' => null,
        'hintSeconds' => null,
        'fake' => true,
        'viewerPlayerId' => $member->id,
    ])
        ->and($snapshot['room']['currentRoundId'])->toBe($round->id)
        ->and(gamePayloadExposesWord($snapshot, 'secret'))->toBeFalse();
});

it('lists ended rounds newest first with names and without the active one', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    [$winnerUser, $winner] = gameRoomMember($room);
    $older = GameRound::factory()->ended(GameRoundOutcome::Passed)->word('kite')->create(['game_room_id' => $room->id, 'ended_at' => now()->subMinutes(5)]);
    $newer = GameRound::factory()->ended(GameRoundOutcome::Solved)->word('lamp')->create(['game_room_id' => $room->id, 'winner_player_id' => $winner->id]);
    activeGameRound($room, ['word' => 'hidden']);

    $history = gameSnapshotFor($room, $host)['history'];

    expect(array_column($history, 'id'))->toBe([$newer->id, $older->id])
        ->and($history[0])->toBe([
            'id' => $newer->id,
            'game' => 'hangman',
            'outcome' => 'solved',
            'word' => 'lamp',
            'question' => null,
            'clue' => null,
            'leaderPlayerId' => null,
            'leaderName' => null,
            'winnerPlayerId' => $winner->id,
            'winnerName' => $winnerUser->name,
            'endedAt' => '2026-10-06T10:00:00+00:00',
            'number' => null,
            'roundsTotal' => null,
        ])
        ->and(gamePayloadExposesWord($history, 'hidden'))->toBeFalse();
});

it('refuses to present an active round as history', function () {
    $round = GameRound::factory()->create();

    resolve(PresentGameRoundHistory::class)->handle($round);
})->throws(LogicException::class);

it('names the facilitator host of an icebreaker room and links to the retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Icebreaker)->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $hostPlayer = GamePlayer::factory()->forParticipant($facilitator)->create(['game_room_id' => $room->id]);
    $this->travel(1)->second();
    $player = GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);

    $snapshot = gameSnapshotFor($room, $player);

    expect($snapshot['room']['hostPlayerId'])->toBe($hostPlayer->id)
        ->and($snapshot['room']['isIcebreaker'])->toBeTrue()
        ->and($snapshot['room']['canDelete'])->toBeFalse()
        ->and($snapshot['room']['guestUrl'])->toBeNull()
        ->and($snapshot['players'][1]['presenceId'])->toBe($participant->id)
        ->and($snapshot['links'])->toBe(['team' => null, 'retro' => route('retros.show', $retro)]);
});

it('leaves rounds without an outcome out of the history', function () {
    $room = GameRoom::factory()->create();
    [, $host] = gameRoomHost($room);
    $complete = GameRound::factory()->ended(GameRoundOutcome::Passed)->word('kite')->create(['game_room_id' => $room->id]);
    GameRound::factory()->ended(GameRoundOutcome::Passed)->word('lamp')->create(['game_room_id' => $room->id, 'outcome' => null]);

    expect(array_column(gameSnapshotFor($room, $host)['history'], 'id'))->toBe([$complete->id]);
});

it('builds the snapshot with a constant number of queries', function () {
    warmInstanceSettings();
    $count = function (int $players, int $rounds): int {
        $room = GameRoom::factory()->create();
        [, $host] = gameRoomHost($room);

        foreach (range(1, $players) as $index) {
            gameRoomMember($room);
        }

        foreach (range(1, $rounds) as $index) {
            $winner = GamePlayer::query()->where('game_room_id', $room->id)->orderBy('id')->first();
            GameRound::factory()->ended()->create(['game_room_id' => $room->id, 'winner_player_id' => $winner?->id, 'leader_player_id' => $host->id]);
        }

        activeGameRound($room);
        $fresh = $room->fresh();
        $viewer = $host->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        resolve(BuildGameSnapshot::class)->handle($fresh, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(8, 12))->toBe($count(2, 2));
});
