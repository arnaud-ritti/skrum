<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** @param array<string, mixed> $values */
function legacyRow(string $table, array $values): object
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => now(), 'updated_at' => now(), ...$values]);

    return DB::table($table)->where('id', $id)->first();
}

/** @return array{0: object, 1: object, 2: object, 3: string, 4: string} */
function legacyBoardWithTwoItems(): array
{
    $workspace = legacyRow('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = legacyRow('teams', ['workspace_id' => $workspace->id, 'name' => 'Platform']);
    $user = legacyRow('users', ['name' => 'Ada', 'email' => 'ada@example.test', 'password' => 'secret']);
    $retro = legacyRow('retros', [
        'team_id' => $team->id,
        'title' => 'Sprint 12',
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
    ]);
    $member = legacyRow('participants', ['retro_id' => $retro->id, 'user_id' => $user->id]);
    $guest = legacyRow('participants', ['retro_id' => $retro->id, 'guest_name' => 'Grace']);
    $done = legacyRow('action_items', [
        'retro_id' => $retro->id,
        'content' => 'Write the runbook',
        'created_by_participant_id' => $member->id,
        'assignee_participant_id' => $member->id,
        'is_done' => true,
        'updated_at' => '2026-09-01 10:00:00',
    ]);
    $open = legacyRow('action_items', [
        'retro_id' => $retro->id,
        'content' => 'Review the alerts',
        'created_by_participant_id' => $guest->id,
        'assignee_participant_id' => $guest->id,
    ]);

    return [$retro, $member, $guest, $done->id, $open->id];
}

it('backfills the new columns from legacy rows by running the migration itself', function () {
    $migration = '2026_10_02_100000_add_v2_columns_to_action_items_table.php';

    migrateBefore($migration);

    [$retro, $member, $guest, $done, $open] = legacyBoardWithTwoItems();

    runMigration($migration);

    $done = DB::table('action_items')->where('id', $done)->first();
    $open = DB::table('action_items')->where('id', $open)->first();

    expect($done->team_id)->toBe($retro->team_id)
        ->and(substr((string) $done->completed_at, 0, 19))->toBe('2026-09-01 10:00:00')
        ->and($done->assignee_user_id)->toBe($member->user_id)
        ->and($done->assignee_participant_id)->toBeNull()
        ->and($done->created_by_user_id)->toBe($member->user_id)
        ->and($open->team_id)->toBe($retro->team_id)
        ->and($open->completed_at)->toBeNull()
        ->and($open->assignee_participant_id)->toBe($guest->id)
        ->and($open->assignee_user_id)->toBeNull()
        ->and($open->created_by_user_id)->toBeNull();
});
