<?php

use App\Actions\Games\DrawGameWord;
use App\Models\GameRoom;
use App\Support\Games\GameWordBook;
use Illuminate\Support\Facades\DB;

function useTinyWordBook(): void
{
    app()->instance(GameWordBook::class, new GameWordBook(words: [
        'en' => [
            ['word' => 'kite', 'drawable' => true],
            ['word' => 'lamp', 'drawable' => true],
            ['word' => 'scope', 'drawable' => false],
        ],
        'fr' => [
            ['word' => 'lune', 'drawable' => true],
        ],
    ]));
}

/**
 * @return array<int, string>
 */
function usedWords(GameRoom $room): array
{
    return DB::table('game_used_words')->where('team_id', $room->team_id)->where('locale', $room->locale)->orderBy('word')->pluck('word')->all();
}

it('never repeats a word for a team and locale until the pool is exhausted', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $draw = resolve(DrawGameWord::class);

    $words = [$draw->handle($room, drawableOnly: false), $draw->handle($room, drawableOnly: false), $draw->handle($room, drawableOnly: false)];

    expect(collect($words)->sort()->values()->all())->toBe(['kite', 'lamp', 'scope'])
        ->and(usedWords($room))->toBe(['kite', 'lamp', 'scope']);
});

it('shares the history between the rooms of a team', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $other = GameRoom::factory()->create(['team_id' => $room->team_id]);
    $draw = resolve(DrawGameWord::class);

    $first = $draw->handle($room, drawableOnly: true);
    $second = $draw->handle($other, drawableOnly: true);

    expect($first)->not->toBe($second);
});

it('keeps separate histories per locale and per team', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $french = GameRoom::factory()->create(['team_id' => $room->team_id, 'locale' => 'fr']);
    $elsewhere = GameRoom::factory()->create();
    $draw = resolve(DrawGameWord::class);

    $draw->handle($room, drawableOnly: true);

    expect($draw->handle($french, drawableOnly: true))->toBe('lune')
        ->and(usedWords($elsewhere))->toBeEmpty();
});

it('uses only drawable words when asked', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $draw = resolve(DrawGameWord::class);

    foreach (range(1, 6) as $attempt) {
        expect($draw->handle($room, drawableOnly: true))->toBeIn(['kite', 'lamp']);
    }
});

it('resets the history once the pool is exhausted and avoids the previous word', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create();
    $draw = resolve(DrawGameWord::class);

    $first = $draw->handle($room, drawableOnly: true);
    $this->travel(1)->seconds();
    $second = $draw->handle($room, drawableOnly: true);
    $this->travel(1)->seconds();
    $third = $draw->handle($room, drawableOnly: true);

    expect($second)->not->toBe($first)
        ->and($third)->not->toBe($second)
        ->and(usedWords($room))->toBe([$third]);
});

it('draws a single-word pool again after a reset', function () {
    useTinyWordBook();
    $room = GameRoom::factory()->create(['locale' => 'fr']);
    $draw = resolve(DrawGameWord::class);

    expect($draw->handle($room, drawableOnly: true))->toBe('lune')
        ->and($draw->handle($room, drawableOnly: true))->toBe('lune');
});

it('draws from the real dictionaries', function () {
    $room = GameRoom::factory()->create(['locale' => 'de']);

    $word = resolve(DrawGameWord::class)->handle($room, drawableOnly: true);

    expect(resolve(GameWordBook::class)->words('de', drawableOnly: true))->toContain($word);
});
