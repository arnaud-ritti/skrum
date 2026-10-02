<?php

use App\Models\Team;
use App\Support\Alphabetical;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

it('sorts names as a person would, whatever their case and accents', function () {
    $names = collect(['Zoe', 'adam', 'Émile', 'eve', 'Bob', 'Élodie']);

    expect(Alphabetical::sort($names, fn (string $name): string => $name)->all())
        ->toBe(['adam', 'Bob', 'Élodie', 'Émile', 'eve', 'Zoe']);
});

it('orders two names that fold alike by their raw form, so the order is stable', function () {
    $names = collect(['eve', 'Eve', 'ève']);

    expect(Alphabetical::sort($names, fn (string $name): string => $name)->all())
        ->toBe(Alphabetical::sort($names->reverse(), fn (string $name): string => $name)->all());
});

it('re-indexes the result', function () {
    expect(Alphabetical::sort(collect([5 => 'b', 9 => 'a']), fn (string $name): string => $name)->keys()->all())->toBe([0, 1]);
});

it('keeps an Eloquent collection an Eloquent collection', function () {
    $teams = new EloquentCollection([new Team(['name' => 'b']), new Team(['name' => 'A'])]);

    $sorted = Alphabetical::sort($teams, fn (Team $team): string => $team->name);

    expect($sorted)->toBeInstanceOf(EloquentCollection::class)
        ->and($sorted->pluck('name')->all())->toBe(['A', 'b']);
});
