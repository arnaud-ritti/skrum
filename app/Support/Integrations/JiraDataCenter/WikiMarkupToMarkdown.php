<?php

namespace App\Support\Integrations\JiraDataCenter;

use App\Support\Integrations\Jira\AdfToMarkdown;
use Closure;
use RuntimeException;

/**
 * Jira Server/Data Center descriptions are wiki markup (spec 8 §4.1). The
 * Markdown is rendered by RenderTaskMarkdown like any imported description;
 * links keep safe schemes only and images become a placeholder. Code,
 * noformat blocks and inline code are kept verbatim.
 */
class WikiMarkupToMarkdown
{
    private const array SafeLinkSchemes = ['http', 'https', 'mailto'];

    private const string BlockMarker = "\u{E000}";

    private const string InlineMarker = "\u{E001}";

    public function convert(?string $wiki): ?string
    {
        if ($wiki === null || trim($wiki) === '') {
            return null;
        }

        $text = str_replace(["\r\n", "\r"], "\n", $wiki);

        try {
            $markdown = $this->markdown($text);
        } catch (RuntimeException) {
            $markdown = trim(mb_scrub($text, 'UTF-8'));
        }

        return $markdown === '' ? null : AdfToMarkdown::truncate($markdown);
    }

    private function markdown(string $text): string
    {
        $blocks = [];

        $text = $this->replace('/\{(code|noformat)(?::([^}]*))?\}(.*?)\{\1\}/s', function (array $match) use (&$blocks): string {
            $language = $match[1] === 'code' ? $this->language($match[2]) : '';
            $blocks[] = "```{$language}\n".trim($match[3], "\n")."\n```";

            return "\n".self::BlockMarker.(count($blocks) - 1).self::BlockMarker."\n";
        }, $text);

        $text = $this->replace('/\{quote\}(.*?)\{quote\}/s', fn (array $match): string => "\n".implode("\n", array_map(
            fn (string $line): string => rtrim("> {$line}"),
            explode("\n", trim($match[1], "\n")),
        ))."\n", $text);

        $lines = [];

        foreach (explode("\n", $text) as $line) {
            array_push($lines, ...$this->line($line));
        }

        $markdown = $this->replace('/'.self::BlockMarker.'(\d+)'.self::BlockMarker.'/u', fn (array $match): string => $blocks[(int) $match[1]] ?? '', implode("\n", $lines));

        return trim($this->replace("/\n{3,}/", "\n\n", $markdown));
    }

    /**
     * @return array<int, string>
     */
    private function line(string $line): array
    {
        if (preg_match('/^\s*h([1-6])\.\s+(.*)$/', $line, $match) === 1) {
            return [str_repeat('#', (int) $match[1]).' '.$this->inline($match[2])];
        }

        if (preg_match('/^\s*bq\.\s+(.*)$/', $line, $match) === 1) {
            return ['> '.$this->inline($match[1])];
        }

        if (preg_match('/^\s*([*#]+|-)\s+(.*)$/', $line, $match) === 1) {
            $marker = str_ends_with($match[1], '#') ? '1.' : '-';

            return [str_repeat('  ', strlen($match[1]) - 1)."{$marker} ".$this->inline($match[2])];
        }

        if (preg_match('/^\s*\|\|(.*)\|\|\s*$/', $line, $match) === 1) {
            $cells = array_map(fn (string $cell): string => $this->inline(trim($cell)), explode('||', $match[1]));

            return ['| '.implode(' | ', $cells).' |', '|'.str_repeat(' --- |', count($cells))];
        }

        if (preg_match('/^\s*\|(.*)\|\s*$/', $line, $match) === 1) {
            $cells = array_map(trim(...), explode('|', $this->inline($match[1])));

            return ['| '.implode(' | ', $cells).' |'];
        }

        return [$this->inline($line)];
    }

    private function inline(string $text): string
    {
        $kept = [];
        $keep = function (string $markdown) use (&$kept): string {
            $kept[] = $markdown;

            return self::InlineMarker.(count($kept) - 1).self::InlineMarker;
        };

        $text = $this->replace('/\{\{(.+?)\}\}/', fn (array $match): string => $keep("`{$match[1]}`"), $text);
        $text = $this->replace('/\[([^\]|\n]*)\|([^\]\n]+)\]/', fn (array $match): string => $keep($this->link(trim($match[1]), trim($match[2]))), $text);
        $text = $this->replace('/\[((?:https?|mailto):[^\]\s]+)\]/i', fn (array $match): string => $keep($this->link($match[1], $match[1])), $text);
        $text = $this->replace('/!([^!\s][^!\n]*)!/', '[attachment]', $text);
        $text = $this->replace('/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/u', '**$1**', $text);
        $text = $this->replace('/(?<![\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/u', '*$1*', $text);
        $text = $this->replace('/(?<![\w-])-(?=\S)([^-\n]*?\S)-(?![\w-])/u', '~~$1~~', $text);
        $text = $this->replace('/\{color(?::[^}]*)?\}/', '', $text);

        return $this->replace('/'.self::InlineMarker.'(\d+)'.self::InlineMarker.'/u', fn (array $match): string => $kept[(int) $match[1]] ?? '', $text);
    }

    private function link(string $label, string $url): string
    {
        $text = $label === '' ? $url : $label;
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        if (! in_array($scheme, self::SafeLinkSchemes, true)) {
            return $text;
        }

        return '['.str_replace(['[', ']'], ['\[', '\]'], $text).']('.str_replace(['(', ')', ' '], ['%28', '%29', '%20'], $url).')';
    }

    private function language(string $options): string
    {
        foreach (explode('|', $options) as $option) {
            $candidate = trim($option);
            $candidate = str_starts_with($candidate, 'language=') ? substr($candidate, 9) : $candidate;

            if (preg_match('/^[A-Za-z0-9+#-]{1,20}$/', $candidate) === 1) {
                return strtolower($candidate);
            }
        }

        return '';
    }

    /**
     * A failed replacement throws instead of turning the text into an empty
     * string, so the description is kept raw rather than lost.
     *
     * @param  string|Closure(array<int|string, string>): string  $replacement
     */
    private function replace(string $pattern, string|Closure $replacement, string $subject): string
    {
        $result = $replacement instanceof Closure
            ? preg_replace_callback($pattern, $replacement, $subject)
            : preg_replace($pattern, $replacement, $subject);

        if ($result === null) {
            throw new RuntimeException(preg_last_error_msg());
        }

        return $result;
    }
}
