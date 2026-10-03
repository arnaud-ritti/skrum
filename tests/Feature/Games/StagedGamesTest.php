<?php

use App\Actions\Games\AdvanceGameTurn;
use App\Actions\Games\DrawGameWord;
use App\Enums\GameKind;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\HangmanRules;
use App\Support\Games\TakesChoices;
use Illuminate\Support\Facades\Event;

beforeEach(fn () => Event::fake());

it('refuses a reveal, a close and a question in a game without stages or questions', function () {
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user] = gameRoomHost($room);
    $round = activeGameRound($room, ['word' => 'rocket']);

    $this->actingAs($user)->postJson(route('games.rounds.reveal.store', [$room, $round]))->assertUnprocessable();
    $this->actingAs($user)->postJson(route('games.rounds.close.store', [$room, $round]))->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => 'Why?'])->assertUnprocessable();
    $this->actingAs($user)->putJson(route('games.rounds.choice.update', [$room, $round]), ['choice' => 'a'])->assertUnprocessable();
});

it('makes, replaces and withdraws a choice in a game that takes choices, and announces only a new or withdrawn one', function () {
    $rules = new class(resolve(DrawGameWord::class), resolve(AdvanceGameTurn::class)) extends HangmanRules implements TakesChoices
    {
        /** @var array<int, bool> */
        public array $announced = [];

        public function choicesFor(GameRound $lockedRound, GamePlayer $player): array
        {
            return ['a', 'b'];
        }

        public function choiceChanged(GameRoom $lockedRoom, GameRound $lockedRound, GamePlayer $player, bool $chose): void
        {
            $this->announced[] = $chose;
        }
    };
    bindGameRules($rules);
    $room = GameRoom::factory()->game(GameKind::Hangman)->create();
    [$user, $player] = gameRoomHost($room);
    $round = activeGameRound($room, ['word' => 'rocket']);
    $uri = route('games.rounds.choice.update', [$room, $round]);

    $this->actingAs($user)->putJson($uri, ['choice' => 'c'])->assertUnprocessable();
    $this->actingAs($user)->putJson($uri, ['choice' => str_repeat('a', 37)])->assertUnprocessable()->assertJsonValidationErrors('choice');
    $this->actingAs($user)->putJson($uri, ['choice' => 'a'])->assertNoContent();
    $this->travel(2)->seconds();
    $this->actingAs($user)->putJson($uri, ['choice' => 'b'])->assertNoContent();

    expect(GameChoice::query()->where('player_id', $player->id)->sole()->choice)->toBe('b');

    $this->actingAs($user)->deleteJson(route('games.rounds.choice.destroy', [$room, $round]))->assertNoContent();

    expect(GameChoice::query()->count())->toBe(0)
        ->and($rules->announced)->toBe([true, false]);
});
