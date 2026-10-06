<?php

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;
use App\Support\RetroTemplates\TemplateCatalogue;
use App\Support\RetroTemplates\TemplateDefinition;

function docsRetroTemplatesPath(): string
{
    return base_path('website/src/data/retro-templates.json');
}

/**
 * @return array{
 *     categories: array<int, array{id: string, name: string}>,
 *     templates: array<int, array{key: string, slug: string, category: string, name: string, columns: array<int, array{title: string, description: string, color: string}>}>
 * }
 */
function docsRetroTemplates(): array
{
    app()->setLocale('en');

    $builtIn = array_filter(TemplateCatalogue::all(), fn (TemplateDefinition $template): bool => $template->category !== null);

    return [
        'categories' => array_map(
            fn (TemplateCategory $category): array => ['id' => $category->value, 'name' => $category->label()],
            TemplateCategory::cases(),
        ),
        'templates' => array_values(array_map(fn (TemplateDefinition $template): array => [
            'key' => $template->key,
            'slug' => str_replace('_', '-', $template->key),
            'category' => $template->category->value,
            'name' => $template->name(),
            'columns' => array_map(
                fn (array $column): array => ['title' => $column['title'], 'description' => $column['description'], 'color' => $column['color']->value],
                $template->translatedColumns(),
            ),
        ], $builtIn)),
    ];
}

it('keeps the website\'s list of retro templates equal to the built-in catalogue', function () {
    $catalogue = docsRetroTemplates();

    if (getenv('UPDATE_DOCS_DATA') === '1') {
        file_put_contents(docsRetroTemplatesPath(), json_encode($catalogue, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
    }

    expect(docsRetroTemplatesPath())->toBeFile('Export it with UPDATE_DOCS_DATA=1 vendor/bin/pest tests/Feature/Docs/RetroTemplateCatalogueTest.php');

    expect(json_decode((string) file_get_contents(docsRetroTemplatesPath()), true, flags: JSON_THROW_ON_ERROR))
        ->toBe($catalogue, 'Export it again with UPDATE_DOCS_DATA=1 vendor/bin/pest tests/Feature/Docs/RetroTemplateCatalogueTest.php');
})->skip(fn () => ! is_dir(base_path('website')), 'The website is not part of this copy of the code.');

it('gives the website only column colours that exist and one address per template', function () {
    $templates = json_decode((string) file_get_contents(docsRetroTemplatesPath()), true, flags: JSON_THROW_ON_ERROR)['templates'];

    $colors = collect($templates)->flatMap(fn (array $template): array => array_column($template['columns'], 'color'))->unique()->values();
    $slugs = array_column($templates, 'slug');

    expect($colors)->not->toBeEmpty()
        ->and($colors->reject(fn (string $color): bool => ColumnColor::tryFrom($color) !== null)->all())->toBe([])
        ->and($slugs)->toBe(array_values(array_unique($slugs)));
})->skip(fn () => ! is_dir(base_path('website')), 'The website is not part of this copy of the code.');
