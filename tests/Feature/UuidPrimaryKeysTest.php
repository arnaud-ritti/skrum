<?php

use App\Models\Passkey;
use App\Models\User;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Passkeys\Passkeys;

it('has no integer key columns on application tables', function () {
    $integerKeyColumns = DB::table('information_schema.columns')
        ->where('table_schema', 'public')
        ->whereNotIn('table_name', ['migrations', 'jobs', 'failed_jobs', 'job_batches'])
        ->where(fn (Builder $query) => $query->where('column_name', 'id')->orWhere('column_name', 'like', '%\_id'))
        ->whereIn('data_type', ['smallint', 'integer', 'bigint'])
        ->get(['table_name', 'column_name'])
        ->map(fn (object $column) => "{$column->table_name}.{$column->column_name}");

    expect($integerKeyColumns)->toBeEmpty();
});

it('gives users a uuid primary key', function () {
    expect(Str::isUuid(User::factory()->create()->id))->toBeTrue();
});

it('uses the uuid passkey model', function () {
    expect(Passkeys::passkeyModel())->toBe(Passkey::class);
});
