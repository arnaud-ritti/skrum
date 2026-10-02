<?php

use App\Models\Passkey;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Passkeys\Passkeys;

it('has no integer key columns on application tables', function () {
    $integerKeyColumns = collect(Schema::getTables())
        ->pluck('name')
        ->reject(fn (string $table): bool => in_array($table, ['migrations', 'jobs', 'failed_jobs', 'job_batches'], true))
        ->flatMap(fn (string $table) => collect(Schema::getColumns($table))
            ->filter(fn (array $column): bool => $column['name'] === 'id' || str_ends_with($column['name'], '_id'))
            ->filter(fn (array $column): bool => str_contains(strtolower($column['type_name']), 'int'))
            ->map(fn (array $column): string => "{$table}.{$column['name']}"));

    expect($integerKeyColumns)->toBeEmpty();
});

it('gives users a uuid primary key', function () {
    expect(Str::isUuid(User::factory()->create()->id))->toBeTrue();
});

it('uses the uuid passkey model', function () {
    expect(Passkeys::passkeyModel())->toBe(Passkey::class);
});
