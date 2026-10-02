<?php

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('has a plain unique index on each owner and name key', function (string $table, array $columns) {
    expect(Schema::hasIndex($table, $columns, 'unique'))->toBeTrue();
})->with([
    ['workspace_templates', ['workspace_id', 'name_key']],
    ['whiteboard_templates', ['workspace_id', 'name_key']],
    ['poker_decks', ['team_id', 'name_key']],
    ['poker_decks', ['workspace_id', 'name_key']],
]);

it('stores the key of a name whenever the name is set', function (string $model) {
    $named = $model::factory()->create(['name' => '  Sprint MAP ']);

    expect($named->fresh()->name_key)->toBe('sprint map');

    $named->update(['name' => 'Été']);

    expect($named->fresh()->name_key)->toBe('été');
})->with([
    'workspace template' => WorkspaceTemplate::class,
    'whiteboard template' => WhiteboardTemplate::class,
    'saved deck' => SavedPokerDeck::class,
]);

it('refuses in the database a second workspace template whose name differs only by case', function () {
    $workspace = Workspace::factory()->create();
    WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']);

    expect(fn () => DB::transaction(fn () => WorkspaceTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'sprint map'])))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('refuses in the database a second whiteboard template whose name differs only by case and spaces', function () {
    $workspace = Workspace::factory()->create();
    WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']);

    expect(fn () => DB::transaction(fn () => WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => ' SPRINT MAP '])))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('refuses in the database a second deck of a team whose name differs only by case', function () {
    $team = Team::factory()->create();
    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Scale']);

    expect(fn () => DB::transaction(fn () => SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'scale'])))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('refuses in the database a second deck of a workspace whose name differs only by case', function () {
    $workspace = Workspace::factory()->create();
    SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'Scale']);

    expect(fn () => DB::transaction(fn () => SavedPokerDeck::factory()->forWorkspace($workspace)->create(['name' => 'SCALE'])))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('accepts the same name under two owners, and for a team and its workspace', function () {
    $team = Team::factory()->create();

    SavedPokerDeck::factory()->create(['team_id' => $team->id, 'name' => 'Scale']);
    SavedPokerDeck::factory()->create(['team_id' => Team::factory()->create()->id, 'name' => 'Scale']);
    SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['name' => 'Scale']);
    SavedPokerDeck::factory()->forWorkspace(Workspace::factory()->create())->create(['name' => 'Scale']);

    expect(SavedPokerDeck::query()->where('name_key', 'scale')->count())->toBe(4);
});

it('refuses a row written without its key', function () {
    $template = WorkspaceTemplate::factory()->create();

    expect(fn () => DB::transaction(fn () => DB::table('workspace_templates')->insert([
        'id' => (string) Str::uuid7(),
        'workspace_id' => $template->workspace_id,
        'name' => 'Written beside the model',
        'category' => $template->category->value,
    ])))->toThrow(QueryException::class);
});
