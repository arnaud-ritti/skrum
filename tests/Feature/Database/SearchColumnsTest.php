<?php

use App\Models\Card;
use App\Models\Retro;
use App\Models\User;
use App\Support\Database\SearchText;
use Illuminate\Support\Facades\DB;

function cardsFound(Retro $retro, string $term): array
{
    return Card::query()->where('retro_id', $retro->id)->whereContains('content', $term)->get()
        ->filter(fn (Card $card): bool => SearchText::contains($card->content, $term))
        ->pluck('content')->sort()->values()->all();
}

it('stores the folded text when a model is created and when its text changes', function () {
    $retro = Retro::factory()->create(['title' => 'Sprint ÉTÉ']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('sprint été');

    $retro->update(['title' => 'Bilan']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('bilan');
});

it('leaves the folded text alone when another column changes', function () {
    $retro = Retro::factory()->create(['title' => 'Sprint']);
    DB::table('retros')->where('id', $retro->id)->update(['title_search' => 'marker']);

    $retro->fresh()->update(['summary' => 'Done']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('marker')
        ->and(DB::table('retros')->where('id', $retro->id)->value('summary_search'))->toBe('done');
});

it('does not show the folded columns when a model is serialised', function () {
    expect(Retro::factory()->create()->fresh()->toArray())->not->toHaveKey('title_search');
});

it('finds a text whatever the case of the term and of the text, accents included', function (string $term) {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Un Été indien']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Un ete sans accent']);

    expect(cardsFound($retro, $term))->toBe(['Un Été indien']);
})->with(['été', 'ÉTÉ', 'Été']);

it('does not find an accented letter by its plain form', function () {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Un Été indien']);

    expect(cardsFound($retro, 'ete'))->toBe([]);
});

it('treats wildcard characters of the term as text', function (string $term, string $match, string $nearMiss) {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => $match]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => $nearMiss]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'nothing alike']);

    expect(cardsFound($retro, $term))->toBe([$match]);
})->with([
    'percent' => ['100%', 'done at 100% today', 'done at 1000 today'],
    'underscore' => ['a_b', 'see a_b here', 'see axb here'],
    'backslash' => ['a\\b', 'path a\\b', 'path a-b'],
    'star' => ['a*b', 'glob a*b', 'glob a.b'],
    'question mark' => ['why?', 'but why? really', 'but whyy really'],
    'bracket' => ['[x]', 'todo [x] done', 'todo -x- done'],
]);

it('returns from sql at most the near misses of a wildcard, never an unrelated row', function () {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'done at 100% today']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'done at 1000 today']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'nothing alike']);

    expect(Card::query()->where('retro_id', $retro->id)->whereContains('content', '100%')->count())->toBe(2);
});

it('searches people by name in any case', function () {
    User::factory()->create(['name' => 'Émile Zola']);

    expect(User::query()->whereContains('name', 'émile z')->count())->toBe(1)
        ->and(User::query()->whereContains('name', 'ZOLA')->count())->toBe(1);
});
