<?php

namespace App\Enums;

enum TemplateCategory: string
{
    case Essentials = 'essentials';
    case TeamMood = 'team_mood';
    case Themed = 'themed';
    case Ideas = 'ideas';
    case Analysis = 'analysis';

    public function label(): string
    {
        $line = __("templates.categories.{$this->value}");

        return is_string($line) ? $line : $this->value;
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     label: string
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $category) => [
            'value' => $category->value,
            'label' => $category->label(),
        ], self::cases());
    }
}
