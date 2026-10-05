<?php

use App\Support\Database\SearchText;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('marks the passwords people chose, and not the ones single sign-on made', function () {
    $migration = '2026_10_26_100200_fill_password_set_at_on_users.php';
    migrateBefore($migration);

    $user = function (string $name, string $createdAt): string {
        $id = (string) Str::uuid7();
        $email = Str::lower($name).'@example.test';

        DB::table('users')->insert([
            'id' => $id, 'name' => $name, 'name_search' => SearchText::fold($name),
            'email' => $email, 'email_key' => $email, 'password' => bcrypt('secret'),
            'created_at' => $createdAt, 'updated_at' => $createdAt,
        ]);

        return $id;
    };
    $link = fn (string $userId, string $createdAt) => DB::table('social_accounts')->insert([
        'id' => (string) Str::uuid7(), 'user_id' => $userId, 'provider' => 'google',
        'provider_user_id' => Str::random(12), 'created_at' => $createdAt, 'updated_at' => $createdAt,
    ]);

    $registered = $user('Ada', '2026-01-10 09:00:00');
    $bornBySso = $user('Lin', '2026-02-01 10:00:00');
    $link($bornBySso, '2026-02-01 10:00:00');
    $linkedLater = $user('Grace', '2026-03-01 08:00:00');
    $link($linkedLater, '2026-05-20 12:00:00');

    $stored = fn () => DB::table('users')->pluck('password_set_at', 'id')->map(fn (mixed $at): ?string => $at === null ? null : substr((string) $at, 0, 19));

    runMigration($migration);

    expect($stored()->get($registered))->toBe('2026-01-10 09:00:00')
        ->and($stored()->get($bornBySso))->toBeNull()
        ->and($stored()->get($linkedLater))->toBe('2026-03-01 08:00:00');

    (require database_path("migrations/{$migration}"))->up();

    expect($stored()->get($registered))->toBe('2026-01-10 09:00:00')
        ->and($stored()->get($bornBySso))->toBeNull()
        ->and($stored()->get($linkedLater))->toBe('2026-03-01 08:00:00');
});
