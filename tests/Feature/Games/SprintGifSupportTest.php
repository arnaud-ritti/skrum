<?php

use App\Actions\Games\PickGifQuestion;
use App\Actions\Games\PresentGameGif;
use App\Actions\Games\PresentGifAnswers;
use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameAnswerChanged;
use App\Events\Games\GameBroadcastEvent;
use App\Events\Games\GameQuestionChanged;
use App\Events\Games\GameRoundRevealed;
use App\Events\Games\GameVoteChanged;
use App\Models\GameGifAnswer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameWordBook;
use App\Support\Gifs\GifCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 10:00:00'));
});

function gifQuestionRound(GameRoom $room, string $question, int $minutesAgo): GameRound
{
    return GameRound::factory()->game(GameKind::SprintGif)->ended(GameRoundOutcome::Revealed)->create([
        'game_room_id' => $room->id,
        'word' => null,
        'question' => $question,
        'started_at' => now()->subMinutes($minutesAgo),
    ]);
}

it('gives answers random ids', function () {
    $answers = GameGifAnswer::factory()->count(3)->create();

    foreach ($answers as $answer) {
        expect(Str::isUuid($answer->id))->toBeTrue()
            ->and($answer->id[14])->toBe('4');
    }
});

it('presents a GIF through the proxy', function () {
    expect(resolve(PresentGameGif::class)->handle('abc123'))->toBe([
        'id' => 'abc123',
        'previewUrl' => route('gifs.show', ['gif' => 'abc123', 'size' => 'preview'], false),
        'url' => route('gifs.show', ['gif' => 'abc123', 'size' => 'full'], false),
    ]);
});

it('picks a question the room did not ask recently', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['One?', 'Two?', 'Three?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create();
    $other = GameRoom::factory()->game(GameKind::SprintGif)->create(['team_id' => $room->team_id]);
    gifQuestionRound($room, 'One?', 3);
    gifQuestionRound($room, 'Two?', 2);
    gifQuestionRound($other, 'Three?', 1);

    expect(resolve(PickGifQuestion::class)->handle($room))->toBe('Three?');
});

it('only avoids the last twenty questions', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['One?', 'Two?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create();
    gifQuestionRound($room, 'One?', 60);

    foreach (range(1, 20) as $minutesAgo) {
        gifQuestionRound($room, 'Two?', $minutesAgo);
    }

    expect(resolve(PickGifQuestion::class)->handle($room))->toBe('One?');
});

it('starts over when every question was asked, never repeating the current one', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['One?', 'Two?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create();
    gifQuestionRound($room, 'One?', 2);
    gifQuestionRound($room, 'Two?', 1);

    expect(resolve(PickGifQuestion::class)->handle($room, 'Two?'))->toBe('One?');
});

it('uses the room locale', function () {
    app()->instance(GameWordBook::class, new GameWordBook(questions: ['en' => ['English?'], 'fr' => ['Français ?']]));
    $room = GameRoom::factory()->game(GameKind::SprintGif)->create(['locale' => 'fr']);

    expect(resolve(PickGifQuestion::class)->handle($room))->toBe('Français ?');
});

it('serves GIFs used by game answers', function () {
    fakeGameGifs('answered1');
    GameGifAnswer::factory()->create(['gif_id' => 'answered1']);

    $catalog = resolve(GifCatalog::class);

    expect($catalog->servable('answered1')?->id)->toBe('answered1')
        ->and($catalog->servable('stranger'))->toBeNull();

    Http::assertSentCount(1);
});

it('names every GIF event and its payload keys', function (Closure $make, string $name, array $keys) {
    $room = GameRoom::factory()->create();

    /** @var GameBroadcastEvent $event */
    $event = $make($room);

    expect($event->broadcastAs())->toBe($name)
        ->and(array_keys($event->broadcastWith()))->toBe($keys);
})->with([
    'question' => [fn (GameRoom $room) => new GameQuestionChanged($room, 'r', 'Q?'), 'game.question.changed', ['roundId', 'question']],
    'answer' => [fn (GameRoom $room) => new GameAnswerChanged($room, 'r', 'p', true), 'game.answer.changed', ['roundId', 'playerId', 'answered']],
    'revealed' => [fn (GameRoom $room) => new GameRoundRevealed($room, ['roundId' => 'r', 'revealedAt' => 'now', 'answers' => []]), 'game.round.revealed', ['roundId', 'revealedAt', 'answers']],
    'vote' => [fn (GameRoom $room) => new GameVoteChanged($room, 'r', 'p', false), 'game.vote.changed', ['roundId', 'playerId', 'voted']],
]);

it('refuses to present revealed answers loaded without their vote counts', function () {
    fakeGameGifs('party');
    [$room] = sprintGifRoom();
    $round = gifQuestionRound($room, 'Which GIF sums up the sprint?', 5);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'gif_id' => 'party']);

    resolve(PresentGifAnswers::class)->closedFrom($round->gifAnswers()->get(), $round, $room);
})->throws(LogicException::class);

it('presents answers of a passed round without vote counts', function () {
    fakeGameGifs('party');
    [$room] = sprintGifRoom();
    $round = GameRound::factory()->game(GameKind::SprintGif)->ended(GameRoundOutcome::Passed)->create(['game_room_id' => $room->id, 'word' => null]);
    GameGifAnswer::factory()->create(['game_round_id' => $round->id, 'gif_id' => 'party']);

    $answers = resolve(PresentGifAnswers::class)->closedFrom($round->gifAnswers()->get(), $round, $room);

    expect($answers)->toHaveCount(1)->and($answers[0]['votes'])->toBeNull();
});
