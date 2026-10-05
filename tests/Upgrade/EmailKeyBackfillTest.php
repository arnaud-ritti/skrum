<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Support\SqlProbe;

/** @param array<int, string> $migrations */
function runAddressMigrations(array $migrations): void
{
    Artisan::call('migrate', [
        '--path' => array_map(fn (string $migration): string => database_path("migrations/{$migration}"), $migrations),
        '--realpath' => true,
    ]);
}

function accountBeforeEmailKey(string $email): string
{
    $id = (string) Str::uuid7();

    DB::table('users')->insert(['id' => $id, 'name' => 'Ada', 'email' => $email, 'password' => 'secret']);

    return $id;
}

it('gives every existing account the key of its address and leaves the address as stored', function () {
    migrateBefore('2026_10_19_100200_add_email_key_to_users_table.php');

    $plain = accountBeforeEmailKey('ada@example.test');
    $legacy = accountBeforeEmailKey('Grace@Example.TEST');
    $legacyTwin = accountBeforeEmailKey('GRACE@example.test');
    foreach (range(1, 500) as $number) {
        accountBeforeEmailKey("person{$number}@example.test");
    }

    runAddressMigrations(['2026_10_19_100200_add_email_key_to_users_table.php']);

    expect(DB::table('users')->whereNull('email_key')->count())->toBe(0)
        ->and(DB::table('users')->where('id', $plain)->value('email_key'))->toBe('ada@example.test')
        ->and(DB::table('users')->where('id', $legacy)->value('email_key'))->toBe('grace@example.test')
        ->and(DB::table('users')->where('id', $legacy)->value('email'))->toBe('Grace@Example.TEST')
        ->and(DB::table('users')->where('id', $legacyTwin)->value('email_key'))->toBe('grace@example.test')
        ->and(DB::table('users')->where('email', 'person500@example.test')->value('email_key'))->toBe('person500@example.test')
        ->and(Schema::hasIndex('users', ['email_key']))->toBeTrue();
});

it('can run a second time, and then writes no account that already has its key', function () {
    migrateBefore('2026_10_19_100200_add_email_key_to_users_table.php');

    $account = accountBeforeEmailKey('Grace@Example.TEST');
    runAddressMigrations(['2026_10_19_100200_add_email_key_to_users_table.php']);
    DB::table('migrations')->where('migration', '2026_10_19_100200_add_email_key_to_users_table')->delete();

    $updates = SqlProbe::updateConditions('users', fn () => runAddressMigrations(['2026_10_19_100200_add_email_key_to_users_table.php']));

    $column = collect(Schema::getColumns('users'))->firstWhere('name', 'email_key');
    $indexes = collect(Schema::getIndexes('users'))->filter(fn (array $index): bool => $index['columns'] === ['email_key']);

    expect($updates)->toBeEmpty()
        ->and(DB::table('users')->where('id', $account)->value('email_key'))->toBe('grace@example.test')
        ->and($column['nullable'])->toBeFalse()
        ->and($indexes)->toHaveCount(1)
        ->and(DB::table('migrations')->where('migration', '2026_10_19_100200_add_email_key_to_users_table')->exists())->toBeTrue();
});

it('fills the keys outside a transaction, so the accounts table is not locked meanwhile', function () {
    $migration = require database_path('migrations/2026_10_19_100200_add_email_key_to_users_table.php');

    expect($migration->withinTransaction)->toBeFalse();
});

it('stores the address of every existing invitation in the form it is looked up by', function () {
    migrateBefore('2026_10_19_100200_add_email_key_to_users_table.php');

    $workspace = (string) Str::uuid7();
    DB::table('workspaces')->insert(['id' => $workspace, 'name' => 'Acme', 'slug' => 'acme', 'created_at' => now(), 'updated_at' => now()]);
    $invitation = fn (string $email): array => [
        'id' => (string) Str::uuid7(),
        'workspace_id' => $workspace,
        'email' => $email,
        'role' => 'member',
        'token_hash' => hash('sha256', $email),
        'expires_at' => now()->addWeek(),
        'created_at' => now(),
        'updated_at' => now(),
    ];
    DB::table('workspace_invitations')->insert([$invitation(' Bob@Example.TEST'), $invitation('carol@example.test')]);

    runAddressMigrations(['2026_10_19_100200_add_email_key_to_users_table.php', '2026_10_19_100300_normalise_workspace_invitation_emails.php']);

    expect(DB::table('workspace_invitations')->orderBy('email')->pluck('email')->all())->toBe(['bob@example.test', 'carol@example.test']);
});
