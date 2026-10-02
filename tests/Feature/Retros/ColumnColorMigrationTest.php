<?php

use App\Enums\ColumnColor;
use App\Models\Column;
use App\Models\WorkspaceTemplateColumn;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Support\Facades\DB;

function runColumnColorMigration(): void
{
    $migration = require database_path('migrations/2026_10_15_100300_map_column_colors_to_the_eight_theme_colors.php');

    $migration->up();
}

it('maps every old column color of both tables to its theme color', function (string $table, string $factory, string $old, ColumnColor $new) {
    $column = $factory::factory()->create();
    DB::table($table)->where('id', $column->id)->update(['color' => $old]);

    runColumnColorMigration();

    expect($column->fresh()->color)->toBe($new);
})->with([
    'columns' => ['columns', Column::class],
    'workspace template columns' => ['workspace_template_columns', WorkspaceTemplateColumn::class],
])->with([
    'green' => ['green', ColumnColor::Moss],
    'red' => ['red', ColumnColor::Coral],
    'blue' => ['blue', ColumnColor::Sky],
    'amber' => ['amber', ColumnColor::Sun],
    'purple' => ['purple', ColumnColor::Plum],
    'slate' => ['slate', ColumnColor::Iris],
]);

it('leaves a column that already has a theme color untouched', function () {
    $column = Column::factory()->create(['color' => ColumnColor::Lagoon]);

    runColumnColorMigration();

    expect($column->fresh()->color)->toBe(ColumnColor::Lagoon);
});

it('has the eight theme colors and no other', function () {
    expect(array_column(ColumnColor::cases(), 'value'))
        ->toBe(['sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss']);
});

it('gives every built-in template columns of the enum', function () {
    $templates = TemplateCatalogue::all();

    expect($templates)->toHaveCount(53);

    foreach ($templates as $template) {
        foreach ($template->columns as $column) {
            expect($column['color'])->toBeInstanceOf(ColumnColor::class);
        }
    }
});
