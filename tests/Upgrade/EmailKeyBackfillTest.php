<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/** @param array<int, string> $migrations */
function runAddressMigrations(array $migrations): void
{
    Artisan::call('migrate', [
        '--path' => array_map(fn (string $migration): string => database_path("migrations/{$migration}"), $migrations),
        '--realpath' => true,
    ]);
}

function migrateUpToEmailKey(): void
{
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < '2026_10_19_100200_add_email_key_to_users_table.php')
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);
}

function accountBeforeEmailKey(string $email): string
{
    $id = (string) Str::uuid7();

    DB::table('users')->insert(['id' => $id, 'name' => 'Ada', 'email' => $email, 'password' => 'secret']);

    return $id;
}

it('gives every existing account the key of its address and leaves the address as stored', function () {
    migrateUpToEmailKey();
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

it('stores the address of every existing invitation in the form it is looked up by', function () {
    migrateUpToEmailKey();
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
