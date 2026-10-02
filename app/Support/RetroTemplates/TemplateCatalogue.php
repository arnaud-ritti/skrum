<?php

namespace App\Support\RetroTemplates;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;

class TemplateCatalogue
{
    public const Custom = 'custom';

    public const Workspace = 'workspace';

    /** @var list<string> The five shortcut cards of a team that has no retro yet, in order. */
    public const array Shortcuts = ['went_well_to_improve_actions', 'start_stop_continue', 'four_ls', 'sailboat', 'mad_sad_glad'];

    private const int CommonCount = 8;

    /**
     * Key => [category, column colours], in the order of docs/superpowers/research/qretro/templates.md.
     * Positive columns are moss, negative ones coral.
     */
    private const array Templates = [
        'went_well_to_improve_actions' => ['essentials', ['moss', 'sun', 'sky']],
        'start_stop_continue' => ['essentials', ['moss', 'coral', 'sky']],
        'four_ls' => ['essentials', ['moss', 'sky', 'sun', 'plum']],
        'sailboat' => ['themed', ['moss', 'coral', 'sun', 'sky']],
        'mad_sad_glad' => ['essentials', ['coral', 'sky', 'moss']],
        'thumbs_up_down_ideas_recognition' => ['essentials', ['moss', 'coral', 'sky', 'plum']],
        'lean_coffee' => ['ideas', ['sky', 'sun', 'plum']],
        'original_four' => ['essentials', ['moss', 'coral', 'sky', 'sun']],
        'starfish' => ['essentials', ['moss', 'sun', 'sky', 'plum', 'coral']],
        'three_little_pigs' => ['themed', ['coral', 'sun', 'moss']],
        'dot_voting' => ['ideas', ['sky']],
        'speed_car' => ['themed', ['moss', 'coral']],
        'happy_meh_sad' => ['team_mood', ['moss', 'sun', 'coral']],
        'idea_prioritization' => ['ideas', ['sky', 'sun', 'plum']],
        'harry_potter' => ['themed', ['moss', 'sky', 'coral', 'plum', 'sun']],
        'kalm' => ['essentials', ['moss', 'sky', 'sun', 'plum']],
        'marie_kondo' => ['themed', ['moss', 'coral', 'sky']],
        'game_of_thrones' => ['themed', ['moss', 'coral', 'sky', 'sun']],
        'love_want_hate_learn' => ['essentials', ['moss', 'sky', 'coral', 'sun']],
        'kudos' => ['team_mood', ['plum', 'moss', 'sun', 'sky']],
        'pros_and_cons' => ['ideas', ['moss', 'coral']],
        'sprint_diagnostics' => ['essentials', ['sky', 'sun', 'plum', 'iris']],
        'three_ls' => ['essentials', ['moss', 'sky', 'sun']],
        'daki' => ['essentials', ['coral', 'sky', 'moss', 'sun']],
        'swot' => ['analysis', ['moss', 'coral', 'sky', 'sun']],
        'good_bad_ugly' => ['essentials', ['moss', 'coral', 'iris']],
        'kanban' => ['ideas', ['sky', 'sun', 'moss']],
        'six_thinking_hats' => ['themed', ['moss', 'sky', 'iris', 'coral', 'plum', 'sun']],
        'post_mortem' => ['analysis', ['moss', 'coral', 'sky', 'sun', 'plum']],
        'rose_bud_thorn' => ['essentials', ['moss', 'sky', 'coral']],
        'hopes_and_fears' => ['team_mood', ['moss', 'coral']],
        'good_bad_better_best' => ['essentials', ['moss', 'coral', 'sky', 'plum']],
        'likes_wishes_wonders' => ['essentials', ['moss', 'sky', 'sun']],
        'okr' => ['ideas', ['sky', 'sun', 'plum']],
        'www' => ['essentials', ['moss', 'sun', 'coral']],
        'safety_check' => ['team_mood', ['moss', 'sky', 'sun', 'plum', 'coral']],
        'fishbone' => ['analysis', ['sky', 'sun', 'plum', 'iris', 'coral', 'moss']],
        'wrap' => ['essentials', ['sky', 'moss', 'coral', 'sun']],
        'learning_matrix' => ['essentials', ['moss', 'coral', 'sky', 'plum']],
        'raid' => ['analysis', ['coral', 'sun', 'plum', 'sky']],
        'liked_lacked_change' => ['essentials', ['moss', 'coral', 'sky', 'sun']],
        'time_added_stolen_restored' => ['essentials', ['moss', 'coral', 'sky']],
        'appreciation' => ['team_mood', ['moss', 'sky', 'coral', 'sun', 'plum']],
        'christmas' => ['themed', ['sun', 'moss', 'sky', 'plum']],
        'good_bad_learned_learning' => ['essentials', ['moss', 'coral', 'sky', 'sun']],
        'halloween' => ['themed', ['plum', 'iris', 'sun', 'sky', 'moss']],
        'plus_delta' => ['essentials', ['moss', 'sun']],
        'energy_levels' => ['team_mood', ['moss', 'sun', 'coral', 'sky']],
        'weather_forecast' => ['team_mood', ['coral', 'sun', 'sky', 'moss']],
        'esvp' => ['team_mood', ['sky', 'sun', 'plum', 'iris']],
        'soar' => ['analysis', ['moss', 'sky', 'plum', 'sun']],
        'pre_mortem' => ['analysis', ['coral', 'sun', 'plum', 'sky']],
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
