<?php

namespace App\Support\Integrations\Jira;

use Carbon\CarbonImmutable;

/**
 * Jira descriptions arrive as Atlassian Document Format. Poker tasks store
 * Markdown, which RenderTaskMarkdown escapes and renders; media is never
 * fetched, it becomes "[attachment]".
 */
class AdfToMarkdown
{
    public const MaxLength = 10000;

    private const SafeLinkSchemes = ['http', 'https', 'mailto'];

    /**
     * @param  array<array-key, mixed>|null  $document
     */
    public function convert(?array $document): ?string
    {
        if ($document === null) {
            return null;
        }

        $markdown = trim($this->blocks($this->children($document)));

        if ($markdown === '') {
            return null;
        }

        return self::truncate($markdown);
    }

    public static function truncate(string $markdown): string
    {
        if (mb_strlen($markdown) <= self::MaxLength) {
            return $markdown;
        }

        return mb_substr($markdown, 0, self::MaxLength - 1).'…';
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private function blocks(array $nodes): string
    {
        $rendered = [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $block = $this->block($node);

            if (trim($block) !== '') {
                $rendered[] = $block;
            }
        }

        return implode("\n\n", $rendered);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function block(array $node): string
    {
        $children = $this->children($node);

        return match ($node['type'] ?? null) {
            'paragraph' => $this->inline($children),
            'heading' => str_repeat('#', $this->headingLevel($node)).' '.$this->inline($children),
            'bulletList' => $this->list($children, null),
            'orderedList' => $this->list($children, $this->startNumber($node)),
            'codeBlock' => $this->codeBlock($node, $children),
            'blockquote', 'panel' => $this->quote($this->blocks($children)),
            'rule' => '---',
            'table' => $this->table($children),
            'mediaSingle', 'mediaGroup', 'media' => '[attachment]',
            'blockCard', 'embedCard' => $this->cardLink($node),
            'expand', 'nestedExpand' => $this->expand($node, $children),
            'text', 'hardBreak', 'mention', 'emoji', 'inlineCard', 'status', 'date' => $this->inline([$node]),
            default => $this->blocks($children),
        };
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private function inline(array $nodes): string
    {
        $rendered = '';

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $rendered .= match ($node['type'] ?? null) {
                'text' => $this->text($node),
                'hardBreak' => "  \n",
                'mention' => $this->escape($this->attribute($node, 'text') ?? '@'.($this->attribute($node, 'id') ?? '')),
                'emoji' => $this->attribute($node, 'text') ?? $this->attribute($node, 'shortName') ?? '',
                'inlineCard' => $this->cardLink($node),
                'status' => $this->escape($this->attribute($node, 'text') ?? ''),
                'date' => $this->date($node),
                'media', 'mediaInline' => '[attachment]',
                default => $this->inline($this->children($node)),
            };
        }

        return $rendered;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function text(array $node): string
    {
        $text = is_string($node['text'] ?? null) ? $node['text'] : '';

        if ($text === '') {
            return '';
        }

        $marks = array_values(array_filter(
            is_array($node['marks'] ?? null) ? $node['marks'] : [],
            fn (mixed $mark): bool => is_array($mark),
        ));
        $types = array_map(fn (array $mark): mixed => $mark['type'] ?? null, $marks);

        if (in_array('code', $types, true)) {
            return str_contains($text, '`') ? "`` {$text} ``" : "`{$text}`";
        }

        $rendered = $this->escape($text);

        if (in_array('strike', $types, true)) {
            $rendered = "~~{$rendered}~~";
        }

        if (in_array('em', $types, true)) {
            $rendered = "*{$rendered}*";
        }

        if (in_array('strong', $types, true)) {
            $rendered = "**{$rendered}**";
        }

        foreach ($marks as $mark) {
            if (($mark['type'] ?? null) !== 'link') {
                continue;
            }

            $href = data_get($mark, 'attrs.href');

            if (is_string($href) && $this->isSafeLink($href)) {
                $rendered = "[{$rendered}]({$this->destination($href)})";
            }
        }

        return $rendered;
    }

    /**
     * @param  array<int, mixed>  $items
     */
    private function list(array $items, ?int $start): string
    {
        $lines = [];
        $number = $start ?? 1;

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $marker = $start === null ? '- ' : ($number++).'. ';
            $indent = str_repeat(' ', strlen($marker));
            $itemLines = explode("\n", $this->listItem($this->children($item)));

            $lines[] = rtrim($marker.array_shift($itemLines));

            foreach ($itemLines as $line) {
                $lines[] = $line === '' ? '' : $indent.$line;
            }
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<int, mixed>  $children
     */
    private function listItem(array $children): string
    {
        $parts = [];

        foreach ($children as $child) {
            if (! is_array($child)) {
                continue;
            }

            $block = $this->block($child);

            if ($block !== '') {
                $parts[] = $block;
            }
        }

        return implode("\n", $parts);
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @param  array<int, mixed>  $children
     */
    private function codeBlock(array $node, array $children): string
    {
        $code = '';

        foreach ($children as $child) {
            if (is_array($child) && is_string($child['text'] ?? null)) {
                $code .= $child['text'];
            }
        }

        $fence = str_contains($code, '```') ? '~~~~' : '```';
        $language = $this->attribute($node, 'language') ?? '';
        $language = preg_match('/^[A-Za-z0-9_+#.-]+$/', $language) === 1 ? $language : '';

        return "{$fence}{$language}\n{$code}\n{$fence}";
    }

    private function quote(string $content): string
    {
        if ($content === '') {
            return '';
        }

        return implode("\n", array_map(
            fn (string $line): string => $line === '' ? '>' : "> {$line}",
            explode("\n", $content),
        ));
    }

    /**
     * @param  array<int, mixed>  $rows
     */
    private function table(array $rows): string
    {
        $lines = [];

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $cells = [];

            foreach ($this->children($row) as $cell) {
                if (is_array($cell)) {
                    $cells[] = str_replace("\n", ' ', $this->blocks($this->children($cell)));
                }
            }

            $lines[] = '| '.implode(' | ', $cells).' |';

            if (count($lines) === 1) {
                $lines[] = '| '.implode(' | ', array_fill(0, max(count($cells), 1), '---')).' |';
            }
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @param  array<int, mixed>  $children
     */
    private function expand(array $node, array $children): string
    {
        $title = $this->attribute($node, 'title');
        $content = $this->blocks($children);

        if ($title === null || $title === '') {
            return $content;
        }

        return trim('**'.$this->escape($title)."**\n\n".$content);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function cardLink(array $node): string
    {
        $url = $this->attribute($node, 'url');

        if ($url === null || ! $this->isSafeLink($url)) {
            return '';
        }

        return '['.$this->escape($url).']('.$this->destination($url).')';
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function date(array $node): string
    {
        $timestamp = $this->attribute($node, 'timestamp');

        if ($timestamp === null || ! ctype_digit($timestamp) || strlen($timestamp) > 14) {
            return '';
        }

        return CarbonImmutable::createFromTimestampMs((int) $timestamp, 'UTC')->toDateString();
    }

    private function destination(string $url): string
    {
        return (string) preg_replace_callback(
            '/[\\x00-\\x20\\x7f()<>"\\[\\]\\\\]/',
            fn (array $match): string => rawurlencode($match[0]),
            $url,
        );
    }

    private function escape(string $text): string
    {
        return (string) preg_replace('/[\\\\`*_\[\]<>|~]/', '\\\\$0', $text);
    }

    private function isSafeLink(string $href): bool
    {
        $scheme = parse_url($href, PHP_URL_SCHEME);

        return is_string($scheme) && in_array(strtolower($scheme), self::SafeLinkSchemes, true);
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function headingLevel(array $node): int
    {
        $level = data_get($node, 'attrs.level');

        return is_int($level) ? max(1, min(6, $level)) : 1;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function startNumber(array $node): int
    {
        $order = data_get($node, 'attrs.order');

        return is_int($order) && $order > 0 ? $order : 1;
    }

    /**
     * @param  array<array-key, mixed>  $node
     */
    private function attribute(array $node, string $key): ?string
    {
        $value = data_get($node, "attrs.{$key}");

        if (is_int($value)) {
            return (string) $value;
        }

        return is_string($value) ? $value : null;
    }

    /**
     * @param  array<array-key, mixed>  $node
     * @return array<int, mixed>
     */
    private function children(array $node): array
    {
        return is_array($node['content'] ?? null) ? array_values($node['content']) : [];
    }
}
