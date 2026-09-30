<?php

namespace App\Actions\Integrations;

/**
 * The provider-neutral issue: Jira receives it as ADF, Linear as
 * Markdown. It never names the creator of the item (spec §7).
 */
class IssueDraft
{
    /**
     * @param  array<int, string>  $lines
     */
    public function __construct(
        public string $title,
        public array $lines,
        public string $origin,
        public string $link,
        public ?string $dueOn,
    ) {}

    public function markdown(): string
    {
        return implode("\n", $this->lines)."\n\n{$this->origin} {$this->link}";
    }

    /**
     * @return array<string, mixed>
     */
    public function adf(): array
    {
        $paragraphs = array_map(fn (string $line): array => [
            'type' => 'paragraph',
            'content' => [['type' => 'text', 'text' => $line]],
        ], $this->lines);

        $paragraphs[] = ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => "{$this->origin} "],
            ['type' => 'text', 'text' => $this->link, 'marks' => [['type' => 'link', 'attrs' => ['href' => $this->link]]]],
        ]];

        return ['type' => 'doc', 'version' => 1, 'content' => $paragraphs];
    }
}
