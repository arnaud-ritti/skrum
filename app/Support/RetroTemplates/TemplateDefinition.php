<?php

namespace App\Support\RetroTemplates;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;

class TemplateDefinition
{
    /**
     * @param  array<int, array{color: ColumnColor, emoji: ?string}>  $columns
     */
    public function __construct(
        public string $key,
        public bool $isCommon,
        public ?TemplateCategory $category,
        public array $columns,
    ) {}

    public function name(): string
    {
        return $this->line("templates.{$this->key}.name");
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: string,
     *     color: ColumnColor
     * }>
     */
    public function translatedColumns(): array
    {
        $columns = [];

        foreach ($this->columns as $index => $column) {
            $title = $this->line("templates.{$this->key}.columns.{$index}.title");

            $columns[] = [
                'title' => $column['emoji'] === null ? $title : "{$column['emoji']} {$title}",
                'description' => $this->line("templates.{$this->key}.columns.{$index}.description"),
                'color' => $column['color'],
            ];
        }

        return $columns;
    }

    private function line(string $key): string
    {
        $line = __($key);

        return is_string($line) ? $line : $key;
    }
}
