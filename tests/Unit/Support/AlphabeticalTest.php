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

it('keeps values that are equal in the order they came in', function () {
    $rows = collect([['id' => 2, 'name' => 'Sam'], ['id' => 1, 'name' => 'Sam'], ['id' => 3, 'name' => 'adam']]);

    expect(Alphabetical::sort($rows, fn (array $row): string => $row['name'])->pluck('id')->all())->toBe([3, 2, 1]);
});

it('sorts names without a Latin form after the Latin ones, by code point', function () {
    $names = collect(['王芳', 'Zoe', '🎉', '李雷', 'adam']);

    expect(Alphabetical::key('李雷'))->toBe('李雷')
        ->and(Alphabetical::sort($names, fn (string $name): string => $name)->all())->toBe(['adam', 'Zoe', '李雷', '王芳', '🎉']);
});

it('does not read digits as numbers', function () {
    $names = collect(['1e3', '1000', '10']);

    expect(Alphabetical::sort($names, fn (string $name): string => $name)->all())->toBe(['10', '1000', '1e3']);
});

it('folds each value once', function () {
    $calls = 0;
    $names = collect(range(1, 50))->map(fn (int $number): string => "name {$number}");

    Alphabetical::sort($names, function (string $name) use (&$calls): string {
        $calls++;

        return $name;
    });

    expect($calls)->toBe(50);
});
