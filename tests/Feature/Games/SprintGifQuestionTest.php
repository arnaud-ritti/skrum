<?php

use App\Enums\GameKind;
use App\Events\Games\GameQuestionChanged;
use App\Models\GameGifAnswer;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
    fakeGameGifs('party');
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['First?', 'Second?', 'Third?']]));
});

it('shuffles the question for the host until the first answer', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room, ['question' => 'First?']);

    $question = $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]))
        ->assertOk()
        ->json('question');

    expect($question)->toBeIn(['Second?', 'Third?'])
        ->and($round->fresh()->question)->toBe($question);

    Event::assertDispatched(fn (GameQuestionChanged $event) => $event->roundId === $round->id
        && $event->question === $question);
});

it('sets a custom question', function () {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => '  What did we ship?  '])
        ->assertOk()
        ->assertExactJson(['question' => 'What did we ship?']);

    expect($round->fresh()->question)->toBe('What did we ship?');
});

it('refuses to change the question once someone answered or the GIFs are revealed', function (string $case) {
    [$room, $user] = sprintGifRoom();
    [, $member] = gameRoomMember($room);
    $round = activeGifRound($room, $case === 'revealed' ? ['revealed_at' => now()] : []);

    if ($case === 'answered') {
        GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'player_id' => $member->id]);
    }

    $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => 'Too late?'])
        ->assertConflict()
        ->assertJsonPath('message', __('The question can no longer be changed.'));
})->with(['answered', 'revealed']);

it('validates the custom question', function (mixed $text) {
    [$room, $user] = sprintGifRoom();
    $round = activeGifRound($room);

    $this->actingAs($user)
        ->putJson(route('games.rounds.question.update', [$room, $round]), ['text' => $text])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('text');
})->with(['empty' => [''], 'blank' => ['   '], 'too long' => [str_repeat('a', 201)], 'not a string' => [['a']]]);

it('keeps the question to the host and to GIF rounds', function () {
    [$room, $user] = sprintGifRoom();
    [$memberUser] = gameRoomMember($room);
    $round = activeGifRound($room);

    $this->actingAs($memberUser)->putJson(route('games.rounds.question.update', [$room, $round]))->assertForbidden();

    $hangman = activeGameRound($room, ['game' => GameKind::Hangman]);

    $this->actingAs($user)->putJson(route('games.rounds.question.update', [$room, $hangman]))->assertUnprocessable();
});
