<?php

use App\Enums\ColumnColor;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

it('[P18e-02-05] renders a board with the eight colours, shows a migrated green column as Moss and recolours it for everyone', function () {
    $retro = Retro::factory()->create(['title' => 'Eight colours']);
    $columns = [];

    foreach (ColumnColor::cases() as $position => $color) {
        $columns[$color->value] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => ucfirst($color->value),
            'color' => $color,
            'position' => $position,
        ]);
    }

    $migrated = $columns['moss'];
    DB::table('columns')->where('id', $migrated->id)->update(['color' => 'green']);
    (require database_path('migrations/2026_10_15_100300_map_column_colors_to_the_eight_theme_colors.php'))->up();

    [$alice] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    $alice->update(['locale' => 'en']);
    $bob->update(['locale' => 'en']);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertCount('[data-test^="retro-column-"]', 8);

    foreach ($columns as $color => $column) {
        $alicePage->assertPresent("[data-test=\"retro-column-{$column->id}\"].col-{$color}");
    }

    $moss = "[data-test=\"retro-column-{$migrated->id}\"]";

    $alicePage->click("{$moss} [aria-label=\"Column menu\"]")
        ->assertCount('[role="menu"] [role="menuitemradio"]', 8)
        ->assertAriaAttribute('[role="menuitemradio"][aria-label="Moss"]', 'checked', 'true')
        ->click('[role="menuitemradio"][aria-label="Lagoon"]')
        ->assertPresent("{$moss}.col-lagoon")
        ->assertNotPresent("{$moss}.col-moss");

    $bobPage->assertPresent("{$moss}.col-lagoon");

    expect($migrated->fresh()->color)->toBe(ColumnColor::Lagoon);
});
