<?php

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

function nameKeysMigration(): object
{
    return require database_path('migrations/2026_10_19_100100_add_name_keys_to_named_tables.php');
}

it('fills the key of every row and keeps the names', function () {
    $workspace = Workspace::factory()->create();
    $template = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']);
    DB::table('workspace_templates')->where('id', $template->id)->update(['name_key' => 'stale']);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    expect($template->fresh()->name_key)->toBe('sprint map')
        ->and($template->fresh()->name)->toBe('Sprint Map');
});

it('gives a later row with the same key a distinct key, keeps both names and logs it', function () {
    Log::spy();
    $workspace = Workspace::factory()->create();
    $older = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint']);
    $newer = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Other']);
    DB::table('workspace_templates')->where('id', $older->id)->update(['name_key' => 'a']);
    DB::table('workspace_templates')->where('id', $newer->id)->update(['name' => 'Sprint ', 'name_key' => 'b']);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    expect($older->fresh()->name_key)->toBe('sprint')
        ->and($newer->fresh()->name)->toBe('Sprint ')
        ->and($newer->fresh()->name_key)->toBe('sprint ~'.substr($newer->id, -8));

    Log::shouldHaveReceived('warning')->once();
});

it('treats the same key under two owners as no collision', function () {
    $first = WorkspaceTemplate::factory()->create(['name' => 'Sprint']);
    $second = WorkspaceTemplate::factory()->create(['name' => 'sprint']);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    expect($first->fresh()->name_key)->toBe('sprint')
        ->and($second->fresh()->name_key)->toBe('sprint');
});

it('treats a deck of a team and a deck of its workspace with the same name as no collision', function () {
    $team = Team::factory()->create();
    $teamDeck = SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Scale']);
    $workspaceDeck = SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['name' => 'scale']);

    nameKeysMigration()->backfill('poker_decks', ['team_id', 'workspace_id']);

    expect($teamDeck->fresh()->name_key)->toBe('scale')
        ->and($workspaceDeck->fresh()->name_key)->toBe('scale');
});

it('keeps the distinct key of a long colliding name within the column', function () {
    Log::spy();
    $workspace = Workspace::factory()->create();
    $name = str_repeat('İ', 80);
    $older = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Older']);
    $newer = WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Newer']);
    DB::table('workspace_templates')->whereIn('id', [$older->id, $newer->id])->update(['name' => $name]);

    nameKeysMigration()->backfill('workspace_templates', ['workspace_id']);

    $olderKey = $older->fresh()->name_key;
    $newerKey = $newer->fresh()->name_key;

    expect(mb_strlen($olderKey))->toBe(160)
        ->and(mb_strlen($newerKey))->toBe(160)
        ->and($newerKey)->toEndWith(' ~'.substr($newer->id, -8))
        ->and($newerKey)->not->toBe($olderKey);
});
