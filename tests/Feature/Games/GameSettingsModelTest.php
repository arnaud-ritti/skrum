<?php

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Enums\GameWeather;
use App\Enums\GameWordTheme;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Models\GameStatementSet;
use App\Models\GameTextAnswer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

it('gives a room created without settings the behaviour rooms had before', function () {
    $room = GameRoom::factory()->create()->fresh();

    expect($room->wordThemes())->toBeEmpty()
        ->and($room->turn_seconds)->toBeNull()
        ->and($room->auto_hints)->toBeFalse()
        ->and($room->takes_turns)->toBeFalse()
        ->and($room->rounds_per_game)->toBeNull()
        ->and($room->gif_votes)->toBe(1)
        ->and($room->gif_authors_hidden)->toBeFalse();
});

it('reads the word themes as enums and ignores an unknown value', function () {
    $room = GameRoom::factory()->create(['word_themes' => ['food', 'films', 'work']])->fresh();

    expect($room->wordThemes())->toBe([GameWordTheme::Food, GameWordTheme::Work]);
});

it('gives a round no number, no turn, one vote and visible authors by default', function () {
    $round = GameRound::factory()->create()->fresh();

    expect($round->number)->toBeNull()
        ->and($round->rounds_total)->toBeNull()
        ->and($round->turnOrder())->toBeEmpty()
        ->and($round->takesTurns())->toBeFalse()
        ->and($round->turn_ends_at)->toBeNull()
        ->and($round->votes_allowed)->toBe(1)
        ->and($round->authors_hidden)->toBeFalse()
        ->and($round->statementsList())->toBeEmpty();
});

it('never serialises the lie, and serialises the statements and the turn', function () {
    $round = GameRound::factory()->game(GameKind::TwoTruths)->create([
        'word' => null,
        'statements' => ['I ski', 'I sing', 'I fly'],
        'lie_index' => 2,
        'turn_order' => ['a', 'b'],
    ]);

    expect($round->toArray())->not->toHaveKey('lie_index')
        ->and($round->toArray()['statements'])->toBe(['I ski', 'I sing', 'I fly'])
        ->and($round->fresh()->turnOrder())->toBe(['a', 'b'])
        ->and($round->fresh()->lie_index)->toBe(2);
});

it('keeps one choice per player and round', function () {
    $round = GameRound::factory()->game(GameKind::MoodWeather)->create(['word' => null]);
    $player = GamePlayer::factory()->create(['game_room_id' => $round->game_room_id]);
    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'choice' => GameWeather::Sunny->value]);

    expect(fn () => DB::transaction(fn () => GameChoice::factory()->create([
        'game_round_id' => $round->id,
        'player_id' => $player->id,
        'choice' => GameWeather::Rainy->value,
    ])))->toThrow(UniqueConstraintViolationException::class);
});

it('gives a text answer a random id, not drawn, one per player and round, deleted with the round', function () {
    $round = GameRound::factory()->game(GameKind::GuessWho)->create(['word' => null]);
    $player = GamePlayer::factory()->create(['game_room_id' => $round->game_room_id]);
    $answer = GameTextAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'text' => 'A llama farm'])->fresh();

    expect($answer->id[14])->toBe('4')
        ->and($answer->is_drawn)->toBeFalse()
        ->and($round->drawnAnswer())->toBeNull()
        ->and(fn () => DB::transaction(fn () => GameTextAnswer::factory()->create([
            'game_round_id' => $round->id,
            'player_id' => $player->id,
            'text' => 'Again',
        ])))->toThrow(UniqueConstraintViolationException::class);

    $answer->forceFill(['is_drawn' => true])->save();

    expect($round->drawnAnswer()?->id)->toBe($answer->id);

    $round->delete();

    expect(GameTextAnswer::query()->count())->toBe(0);
});

it('stores a player id as a choice', function () {
    $round = GameRound::factory()->game(GameKind::GuessWho)->create(['word' => null]);
    $player = GamePlayer::factory()->create(['game_room_id' => $round->game_room_id]);
    $named = GamePlayer::factory()->create(['game_room_id' => $round->game_room_id]);

    GameChoice::factory()->create(['game_round_id' => $round->id, 'player_id' => $player->id, 'choice' => $named->id]);

    expect(GameChoice::query()->sole()->choice)->toBe($named->id);
});

it('keeps one statement set per player and room, hides it, survives the rounds and goes with the player', function () {
    $room = GameRoom::factory()->game(GameKind::TwoTruths)->create();
    $player = GamePlayer::factory()->create(['game_room_id' => $room->id]);
    $set = GameStatementSet::factory()->create([
        'game_room_id' => $room->id,
        'player_id' => $player->id,
        'statements' => ['I ski', 'I sing', 'I fly'],
        'lie_index' => 2,
    ])->fresh();

    expect($set->isReady())->toBeTrue()
        ->and($set->statementsList())->toBe(['I ski', 'I sing', 'I fly'])
        ->and($set->toArray())->not->toHaveKey('lie_index')
        ->and($set->toArray())->not->toHaveKey('statements')
        ->and($room->statementSets()->count())->toBe(1)
        ->and(fn () => DB::transaction(fn () => GameStatementSet::factory()->create([
            'game_room_id' => $room->id,
            'player_id' => $player->id,
        ])))->toThrow(UniqueConstraintViolationException::class);

    GameRound::factory()->for($room, 'room')->create(['word' => null])->delete();

    expect(GameStatementSet::query()->count())->toBe(1);

    $set->forceFill(['played_at' => now()])->save();

    expect($set->fresh()->isPlayed())->toBeTrue();

    $player->delete();

    expect(GameStatementSet::query()->count())->toBe(0);
});

it('labels the new games, the new outcome, the themes and the weathers', function () {
    expect(GameKind::TwoTruths->label())->toBe(__('Two truths and a lie'))
        ->and(GameKind::MoodWeather->label())->toBe(__('Mood weather'))
        ->and(GameKind::GuessWho->label())->toBe(__('Guess who?'))
        ->and(GameKind::QuickQuestion->label())->toBe(__('Quick question'))
        ->and(GameRoundOutcome::Finished->value)->toBe('finished')
        ->and(GameWordTheme::Work->label())->toBe(__('Team & tech'))
        ->and(GameWeather::PartlyCloudy->value)->toBe('partly_cloudy')
        ->and(GameWeather::Stormy->icon())->toBe('cloud-lightning');
});
