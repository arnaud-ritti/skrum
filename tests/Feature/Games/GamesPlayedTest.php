<?php

use App\Actions\Games\BuildGamesPlayed;
use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\PresentGameRoundHistory;
use App\Actions\Games\RoomLeaderboard;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\RetroPhase;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

/**
 * @return array{0: Retro, 1: User, 2: GameRoom, 3: GamePlayer, 4: User, 5: GamePlayer}
 */
function playedIcebreaker(bool $anonymous = false): array
{
    $retro = Retro::factory()->withIcebreaker()->withGuestAccess()->inPhase(RetroPhase::Icebreaker)->create([
        'is_anonymous' => $anonymous,
        'icebreaker_game' => GameKind::DrawAndGuess,
    ]);
    [$facilitator] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran'])->save();
    [$member, $memberParticipant] = retroMember($retro);
    $member->forceFill(['name' => 'Mo'])->save();
    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $host = $room->players()->sole();
    $memberPlayer = GamePlayer::factory()->forParticipant($memberParticipant)->create(['game_room_id' => $room->id]);

    return [$retro, $facilitator, $room, $host, $member, $memberPlayer];
}

function endedIcebreakerRound(GameRoom $room, GameKind $game, GameRoundOutcome $outcome, int $minute, array $attributes = []): GameRound
{
    return GameRound::factory()->game($game)->create([
        'game_room_id' => $room->id,
        'outcome' => $outcome,
        'started_at' => now()->addMinutes($minute - 1),
        'ended_at' => now()->addMinutes($minute),
        ...$attributes,
    ]);
}

function completeIcebreakerRetro(Retro $retro): void
{
    $retro->update(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
}

it('is null without an icebreaker room or with abandoned rounds only', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();

    expect(resolve(BuildGamesPlayed::class)->handle($retro))->toBeNull();

    [$retro, , $room] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Abandoned, 1);
    activeGameRound($room);

    expect(resolve(BuildGamesPlayed::class)->handle($retro->fresh()))->toBeNull();
});

it('lists the ended rounds oldest first with leader, winner and word, never a guess', function () {
    [$retro, $facilitator, $room, $host, $member, $memberPlayer] = playedIcebreaker();
    $hangman = endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Solved, 5, ['word' => 'sprint', 'winner_player_id' => $memberPlayer->id]);
    $drawing = endedIcebreakerRound($room, GameKind::DrawAndGuess, GameRoundOutcome::Guessed, 2, [
        'word' => 'rocket',
        'leader_player_id' => $host->id,
        'winner_player_id' => $memberPlayer->id,
    ]);
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Abandoned, 3, ['word' => 'teapot']);
    GameGuess::factory()->create(['game_round_id' => $drawing->id, 'player_id' => $memberPlayer->id, 'text' => 'banana']);
    completeIcebreakerRetro($retro);

    $games = $this->actingAs($facilitator)
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->json('results.games');

    expect($games['roomId'])->toBe($room->id)
        ->and($games['roundsPlayed'])->toBe(2)
        ->and($games['rounds'][0])->toBe([
            'id' => $drawing->id,
            'game' => 'draw',
            'outcome' => 'guessed',
            'word' => 'rocket',
            'question' => null,
            'clue' => null,
            'leader' => ['playerId' => $host->id, 'name' => 'Fran', 'avatarUrl' => $host->avatarUrl(), 'isGuest' => false],
            'winner' => ['playerId' => $memberPlayer->id, 'name' => 'Mo', 'avatarUrl' => $memberPlayer->avatarUrl(), 'isGuest' => false],
            'answers' => null,
            'endedAt' => $drawing->fresh()->ended_at->toIso8601String(),
        ])
        ->and($games['rounds'][1]['id'])->toBe($hangman->id)
        ->and($games['rounds'][1]['leader'])->toBeNull()
        ->and(json_encode($games))->not->toContain('banana')
        ->and(json_encode($games))->not->toContain('teapot');
});

it('presents the shared fields exactly as the room history does', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();
    $round = endedIcebreakerRound($room, GameKind::DrawAndGuess, GameRoundOutcome::Guessed, 2, [
        'word' => 'rocket',
        'leader_player_id' => $host->id,
        'winner_player_id' => $memberPlayer->id,
    ]);

    $history = resolve(PresentGameRoundHistory::class)->handle($round->fresh()->load(PresentGameRoundHistory::Relations));
    $played = resolve(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0];

    foreach (['id', 'game', 'outcome', 'word', 'question', 'endedAt'] as $key) {
        expect($played[$key])->toBe($history[$key]);
    }

    expect($played['leader']['playerId'])->toBe($history['leaderPlayerId'])
        ->and($played['winner']['name'])->toBe($history['winnerName']);
});

it('keeps the clue of Decoded rounds', function () {
    [$retro, , $room, $host] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Decoded, GameRoundOutcome::TimedOut, 1, ['word' => 'coffee', 'leader_player_id' => $host->id, 'clue' => ['☕', '🔥']]);

    expect(resolve(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0]['clue'])->toBe(['☕', '🔥']);
});

it('lists GIF answers with their authors and final votes', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();
    $round = endedIcebreakerRound($room, GameKind::SprintGif, GameRoundOutcome::Revealed, 1, ['word' => null, 'question' => 'How did the sprint feel?']);
    $memberAnswer = GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $memberPlayer->id, 'gif_id' => 'memberGif']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id, 'gif_id' => 'hostGif']);
    GameGifVote::factory()->create(['game_round_id' => $round->id, 'voter_player_id' => $host->id, 'answer_id' => $memberAnswer->id]);

    $answers = collect(resolve(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0]['answers'])->keyBy('gif.id');

    expect($answers['memberGif'])->toBe([
        'gif' => gameGifPayload('memberGif'),
        'caption' => null,
        'playerId' => $memberPlayer->id,
        'votes' => 1,
    ])
        ->and($answers['hostGif']['playerId'])->toBe($host->id)
        ->and($answers['hostGif']['votes'])->toBe(0);
});

it('hides GIF authors on anonymous retros', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker(anonymous: true);
    $round = endedIcebreakerRound($room, GameKind::SprintGif, GameRoundOutcome::Revealed, 1, ['word' => null, 'question' => 'How did the sprint feel?']);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $memberPlayer->id]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $host->id]);

    $answers = resolve(BuildGamesPlayed::class)->handle($retro->fresh())['rounds'][0]['answers'];

    expect(collect($answers)->pluck('playerId')->unique()->all())->toBe([null]);
});

it('ranks the icebreaker players as the room leaderboard does', function () {
    [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Solved, 1, ['winner_player_id' => $memberPlayer->id]);
    awardGamePoints($room, $memberPlayer, 9, true);
    awardGamePoints($room, $host, 2);

    $leaderboard = resolve(BuildGamesPlayed::class)->handle($retro->fresh())['leaderboard'];

    expect($leaderboard)->toBe([
        ['playerId' => $memberPlayer->id, 'name' => 'Mo', 'avatarUrl' => $memberPlayer->avatarUrl(), 'isGuest' => false, 'points' => 9, 'wins' => 1, 'roundsPlayed' => 1],
        ['playerId' => $host->id, 'name' => 'Fran', 'avatarUrl' => $host->avatarUrl(), 'isGuest' => false, 'points' => 2, 'wins' => 0, 'roundsPlayed' => 1],
    ])
        ->and(collect($leaderboard)->pluck('playerId')->all())->toBe(collect(resolve(RoomLeaderboard::class)->handle($room->fresh()))->pluck('playerId')->all());
});

it('shows the games to guests and after the icebreaker was turned off', function () {
    [$retro, , $room] = playedIcebreaker();
    endedIcebreakerRound($room, GameKind::Hangman, GameRoundOutcome::Lost, 1);
    completeIcebreakerRetro($retro);
    $retro->update(['icebreaker_enabled' => false]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->getJson(route('retros.snapshot.show', $retro))
        ->assertOk()
        ->assertJsonPath('results.games.roundsPlayed', 1)
        ->assertJsonPath('results.games.rounds.0.word', 'sprint');
});

it('builds the games with a constant number of queries', function () {
    warmInstanceSettings();
    $count = function (int $rounds, int $extraPlayers): int {
        [$retro, , $room, $host, , $memberPlayer] = playedIcebreaker();

        foreach (range(1, $extraPlayers) as $index) {
            $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create()->id]);
            GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
        }

        foreach (range(1, $rounds) as $minute) {
            $gif = endedIcebreakerRound($room, GameKind::SprintGif, GameRoundOutcome::Revealed, $minute * 2, ['word' => null, 'question' => 'Q', 'winner_player_id' => null]);
            $answer = GameGifAnswer::factory()->create(['game_round_id' => $gif->id, 'player_id' => $memberPlayer->id]);
            GameGifVote::factory()->create(['game_round_id' => $gif->id, 'voter_player_id' => $host->id, 'answer_id' => $answer->id]);
            endedIcebreakerRound($room, GameKind::DrawAndGuess, GameRoundOutcome::Guessed, $minute * 2 + 1, ['leader_player_id' => $host->id, 'winner_player_id' => $memberPlayer->id]);
            awardGamePoints($room, $memberPlayer, 2);
        }

        $retro = $retro->fresh();

        DB::flushQueryLog();
        DB::enableQueryLog();
        resolve(BuildGamesPlayed::class)->handle($retro);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    expect($count(1, 1))->toBe($count(6, 4));
});
