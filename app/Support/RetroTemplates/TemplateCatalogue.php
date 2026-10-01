<?php

namespace App\Support\RetroTemplates;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;

class TemplateCatalogue
{
    public const Custom = 'custom';

    public const Workspace = 'workspace';

    private const int CommonCount = 8;

    /**
     * Key => [category, column colours], in the order of docs/superpowers/research/qretro/templates.md.
     * Positive columns are green, negative ones red.
     */
    private const array Templates = [
        'went_well_to_improve_actions' => ['essentials', ['green', 'amber', 'blue']],
        'start_stop_continue' => ['essentials', ['green', 'red', 'blue']],
        'four_ls' => ['essentials', ['green', 'blue', 'amber', 'purple']],
        'sailboat' => ['themed', ['green', 'red', 'amber', 'blue']],
        'mad_sad_glad' => ['essentials', ['red', 'blue', 'green']],
        'thumbs_up_down_ideas_recognition' => ['essentials', ['green', 'red', 'blue', 'purple']],
        'lean_coffee' => ['ideas', ['blue', 'amber', 'purple']],
        'original_four' => ['essentials', ['green', 'red', 'blue', 'amber']],
        'starfish' => ['essentials', ['green', 'amber', 'blue', 'purple', 'red']],
        'three_little_pigs' => ['themed', ['red', 'amber', 'green']],
        'dot_voting' => ['ideas', ['blue']],
        'speed_car' => ['themed', ['green', 'red']],
        'happy_meh_sad' => ['team_mood', ['green', 'amber', 'red']],
        'idea_prioritization' => ['ideas', ['blue', 'amber', 'purple']],
        'harry_potter' => ['themed', ['green', 'blue', 'red', 'purple', 'amber']],
        'kalm' => ['essentials', ['green', 'blue', 'amber', 'purple']],
        'marie_kondo' => ['themed', ['green', 'red', 'blue']],
        'game_of_thrones' => ['themed', ['green', 'red', 'blue', 'amber']],
        'love_want_hate_learn' => ['essentials', ['green', 'blue', 'red', 'amber']],
        'kudos' => ['team_mood', ['purple', 'green', 'amber', 'blue']],
        'pros_and_cons' => ['ideas', ['green', 'red']],
        'sprint_diagnostics' => ['essentials', ['blue', 'amber', 'purple', 'slate']],
        'three_ls' => ['essentials', ['green', 'blue', 'amber']],
        'daki' => ['essentials', ['red', 'blue', 'green', 'amber']],
        'swot' => ['analysis', ['green', 'red', 'blue', 'amber']],
        'good_bad_ugly' => ['essentials', ['green', 'red', 'slate']],
        'kanban' => ['ideas', ['blue', 'amber', 'green']],
        'six_thinking_hats' => ['themed', ['green', 'blue', 'slate', 'red', 'purple', 'amber']],
        'post_mortem' => ['analysis', ['green', 'red', 'blue', 'amber', 'purple']],
        'rose_bud_thorn' => ['essentials', ['green', 'blue', 'red']],
        'hopes_and_fears' => ['team_mood', ['green', 'red']],
        'good_bad_better_best' => ['essentials', ['green', 'red', 'blue', 'purple']],
        'likes_wishes_wonders' => ['essentials', ['green', 'blue', 'amber']],
        'okr' => ['ideas', ['blue', 'amber', 'purple']],
        'www' => ['essentials', ['green', 'amber', 'red']],
        'safety_check' => ['team_mood', ['green', 'blue', 'amber', 'purple', 'red']],
        'fishbone' => ['analysis', ['blue', 'amber', 'purple', 'slate', 'red', 'green']],
        'wrap' => ['essentials', ['blue', 'green', 'red', 'amber']],
        'learning_matrix' => ['essentials', ['green', 'red', 'blue', 'purple']],
        'raid' => ['analysis', ['red', 'amber', 'purple', 'blue']],
        'liked_lacked_change' => ['essentials', ['green', 'red', 'blue', 'amber']],
        'time_added_stolen_restored' => ['essentials', ['green', 'red', 'blue']],
        'appreciation' => ['team_mood', ['green', 'blue', 'red', 'amber', 'purple']],
        'christmas' => ['themed', ['amber', 'green', 'blue', 'purple']],
        'good_bad_learned_learning' => ['essentials', ['green', 'red', 'blue', 'amber']],
        'halloween' => ['themed', ['purple', 'slate', 'amber', 'blue', 'green']],
        'plus_delta' => ['essentials', ['green', 'amber']],
        'energy_levels' => ['team_mood', ['green', 'amber', 'red', 'blue']],
        'weather_forecast' => ['team_mood', ['red', 'amber', 'blue', 'green']],
        'esvp' => ['team_mood', ['blue', 'amber', 'purple', 'slate']],
        'soar' => ['analysis', ['green', 'blue', 'purple', 'amber']],
        'pre_mortem' => ['analysis', ['red', 'amber', 'purple', 'blue']],
        self::Custom => [null, []],
    ];

    private const array ColumnEmoji = [
        'thumbs_up_down_ideas_recognition' => ['👍', '👎', '💡', '🏆'],
        'wrap' => ['😇', '🤗', '😨', '😵'],
        'appreciation' => ['😃', '🤔', '😢', '✅', '🙏'],
    ];

    /**
     * @return array<int, TemplateDefinition>
     */
    public static function all(): array
    {
        $definitions = [];

        foreach (array_keys(self::Templates) as $position => $key) {
            [$category, $colors] = self::Templates[$key];
            $emoji = self::ColumnEmoji[$key] ?? [];

            $definitions[] = new TemplateDefinition(
                key: $key,
                isCommon: $position < self::CommonCount,
                category: $category === null ? null : TemplateCategory::from($category),
                columns: array_map(
                    fn (string $color, int $index): array => ['color' => ColumnColor::from($color), 'emoji' => $emoji[$index] ?? null],
                    $colors,
                    array_keys($colors),
                ),
            );
        }

        return $definitions;
    }

    public static function find(string $key): ?TemplateDefinition
    {
        foreach (self::all() as $definition) {
            if ($definition->key === $key) {
                return $definition;
            }
        }

        return null;
    }

    public static function has(string $key): bool
    {
        return self::find($key) !== null;
    }
}
