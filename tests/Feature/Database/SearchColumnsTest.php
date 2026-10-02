<?php

use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\User;
use App\Models\Whiteboard;
use App\Support\Database\SearchText;
use Database\Seeders\DatabaseSeeder;
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

it('never returns from sql a row unrelated to a term that holds a wildcard', function () {
    $retro = Retro::factory()->create();
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'done at 100% today']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'nothing alike']);

    expect(Card::query()->where('retro_id', $retro->id)->whereContains('content', '100%')->pluck('content')->all())
        ->toBe(['done at 100% today']);
});

it('fills a folded text left empty by a write that skipped the model, at the next save', function () {
    $retro = Retro::factory()->create(['title' => 'Sprint ÉTÉ']);
    DB::table('retros')->where('id', $retro->id)->update(['title_search' => null]);

    $retro->fresh()->update(['summary' => 'Done']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('sprint été');
});

it('keeps the folded text when a model read without its text is saved', function () {
    $retro = Retro::factory()->create(['title' => 'Sprint ÉTÉ']);

    Retro::query()->select(['id', 'summary'])->findOrFail($retro->id)->update(['summary' => 'Done']);

    expect(DB::table('retros')->where('id', $retro->id)->value('title_search'))->toBe('sprint été');
});

it('finds a text by a term of another case in every searched model', function (string $model, string $column) {
    $found = $model::factory()->create([$column => 'Bilan ÉTÉ']);

    expect($model::query()->whereContains($column, 'été')->pluck('id')->all())->toBe([$found->id]);
})->with([
    [Retro::class, 'title'],
    [Retro::class, 'summary'],
    [Card::class, 'content'],
    [ActionItem::class, 'content'],
    [PokerTask::class, 'title'],
    [User::class, 'name'],
    [PokerGame::class, 'title'],
    [Whiteboard::class, 'title'],
    [GameRoom::class, 'name'],
]);

it('gives the user created by the default seeder a folded name', function () {
    $this->seed(DatabaseSeeder::class);

    expect(DB::table('users')->where('email', 'test@example.com')->value('name_search'))->toBe('test user');
});

it('searches people by name in any case', function () {
    User::factory()->create(['name' => 'Émile Zola']);

    expect(User::query()->whereContains('name', 'émile z')->count())->toBe(1)
        ->and(User::query()->whereContains('name', 'ZOLA')->count())->toBe(1);
});

it('finds a person by a part of their address in any case, a legacy address included', function (string $term) {
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
    $current = User::factory()->create(['name' => 'Ada', 'email' => 'lovelace@example.org']);
    $legacy = User::factory()->storedWithAddress('Grace.LOVELACE@Example.org')->create(['name' => 'Grace']);
    User::factory()->create(['name' => 'Unrelated', 'email' => 'unrelated@example.org']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => $term]))
        ->assertOk()
        ->assertJsonPath('candidates.*.id', [$current->id, $legacy->id]);
})->with(['lovelace@', 'LOVELACE@EXAMPLE', 'Lovelace@Example.org']);
