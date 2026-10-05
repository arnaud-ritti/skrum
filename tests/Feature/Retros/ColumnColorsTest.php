<?php

use App\Enums\ColumnColor;
use App\Support\RetroTemplates\TemplateCatalogue;

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
