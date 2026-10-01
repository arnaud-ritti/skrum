<?php

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;
use App\Support\RetroTemplates\TemplateCatalogue;
use App\Support\RetroTemplates\TemplateDefinition;

function catalogueKeys(): array
{
    return array_map(fn (TemplateDefinition $definition) => $definition->key, TemplateCatalogue::all());
}

it('lists the 52 templates in catalogue order with custom last', function () {
    $keys = catalogueKeys();

    expect($keys)->toHaveCount(53)
        ->and(array_unique($keys))->toBe($keys)
        ->and(array_slice($keys, 0, 8))->toBe([
            'went_well_to_improve_actions', 'start_stop_continue', 'four_ls', 'sailboat',
            'mad_sad_glad', 'thumbs_up_down_ideas_recognition', 'lean_coffee', 'original_four',
        ])
        ->and($keys[52])->toBe(TemplateCatalogue::Custom)
        ->and($keys)->each->toMatch('/^[a-z0-9_]+$/');
});

it('marks the first eight templates as common', function () {
    $common = array_values(array_filter(TemplateCatalogue::all(), fn (TemplateDefinition $definition) => $definition->isCommon));

    expect(array_map(fn (TemplateDefinition $definition) => $definition->key, $common))->toBe(array_slice(catalogueKeys(), 0, 8));
});

it('assigns every built-in template but custom to exactly one category', function () {
    $counts = collect(TemplateCatalogue::all())
        ->reject(fn (TemplateDefinition $definition) => $definition->key === TemplateCatalogue::Custom)
        ->countBy(fn (TemplateDefinition $definition) => $definition->category?->value)
        ->all();

    expect($counts)->toEqual(['essentials' => 23, 'team_mood' => 8, 'themed' => 9, 'ideas' => 6, 'analysis' => 6])
        ->and(TemplateCatalogue::find('custom')?->category)->toBeNull()
        ->and(TemplateCatalogue::find('custom')?->columns)->toBe([])
        ->and(TemplateCatalogue::find('sailboat')?->category)->toBe(TemplateCategory::Themed)
        ->and(TemplateCatalogue::find('kudos')?->category)->toBe(TemplateCategory::TeamMood)
        ->and(TemplateCatalogue::find('lean_coffee')?->category)->toBe(TemplateCategory::Ideas)
        ->and(TemplateCatalogue::find('pre_mortem')?->category)->toBe(TemplateCategory::Analysis)
        ->and(TemplateCatalogue::find('plus_delta')?->category)->toBe(TemplateCategory::Essentials);
});

it('keeps the five original templates, names and columns', function () {
    app()->setLocale('en');

    $titles = fn (string $key) => array_column(TemplateCatalogue::find($key)?->translatedColumns() ?? [], 'title');

    expect(TemplateCatalogue::find('start_stop_continue')?->name())->toBe('Start, Stop, Continue')
        ->and($titles('start_stop_continue'))->toBe(['Start', 'Stop', 'Continue'])
        ->and($titles('mad_sad_glad'))->toBe(['Mad', 'Sad', 'Glad'])
        ->and($titles('four_ls'))->toBe(['Liked', 'Learned', 'Lacked', 'Longed for'])
        ->and($titles('went_well_to_improve_actions'))->toBe(['Went well', 'To improve', 'Action ideas'])
        ->and(array_column(TemplateCatalogue::find('mad_sad_glad')?->translatedColumns() ?? [], 'color'))
        ->toBe([ColumnColor::Red, ColumnColor::Blue, ColumnColor::Green]);
});

it('puts the column emoji in front of the title', function () {
    app()->setLocale('en');

    expect(TemplateCatalogue::find('thumbs_up_down_ideas_recognition')?->translatedColumns()[0]['title'])->toBe('👍 Thumbs up');
});

it('finds only known keys', function () {
    expect(TemplateCatalogue::has('sailboat'))->toBeTrue()
        ->and(TemplateCatalogue::has('workspace'))->toBeFalse()
        ->and(TemplateCatalogue::find('nope'))->toBeNull();
});

it('translates every template within the column limits', function (string $locale) {
    app()->setLocale($locale);

    foreach (TemplateCatalogue::all() as $definition) {
        $translatedColumns = trans("templates.{$definition->key}.columns", [], $locale);

        expect($definition->name())->not->toBe("templates.{$definition->key}.name")
            ->and(is_array($translatedColumns) ? count($translatedColumns) : 0)->toBe(count($definition->columns), $definition->key);

        foreach ($definition->translatedColumns() as $column) {
            expect(mb_strlen($column['title']))->toBeGreaterThan(0)->toBeLessThanOrEqual(100)
                ->and(mb_strlen($column['description']))->toBeGreaterThan(0)->toBeLessThanOrEqual(200);
        }
    }

    foreach (TemplateCategory::cases() as $category) {
        expect($category->label())->not->toBe("templates.categories.{$category->value}");
    }
})->with(['en', 'fr', 'es', 'de']);

it('copies the existing french titles of the original templates', function () {
    app()->setLocale('fr');

    expect(array_column(TemplateCatalogue::find('start_stop_continue')?->translatedColumns() ?? [], 'title'))
        ->toBe(['Commencer', 'Arrêter', 'Continuer'])
        ->and(TemplateCatalogue::find('mad_sad_glad')?->name())->toBe('En colère, Triste, Content');
});
