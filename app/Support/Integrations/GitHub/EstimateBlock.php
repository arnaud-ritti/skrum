<?php

namespace App\Support\Integrations\GitHub;

use InvalidArgumentException;

/**
 * The one block of a GitHub issue body skrum owns (spec 8 §4.2):
 *
 *     <!-- skrum:estimate -->
 *     **Estimate:** 5
 *     <!-- /skrum:estimate -->
 *
 * Markers must stand on their own lines and match case-sensitively. Every
 * byte outside the block is preserved; hand-made copies collapse into the
 * first block; clearing removes the block with the blank line before it.
 * An opening marker without a closing one never swallows a later block.
 */
class EstimateBlock
{
    public const Open = '<!-- skrum:estimate -->';

    public const Close = '<!-- /skrum:estimate -->';

    public const MaxBodyLength = 65536;

    private const Label = '**Estimate:**';

    private const NeverWritten = ['?', '☕'];

    private const Blank = " \t";

    public static function value(?string $body): ?string
    {
        $blocks = self::blocks((string) $body);
        $lines = $blocks === [] ? [] : explode("\n", $blocks[0][0], 3);

        if (count($lines) < 3) {
            return null;
        }

        $valueLine = ltrim($lines[1], self::Blank);

        if (! str_starts_with($valueLine, self::Label)) {
            return null;
        }

        $value = GitHubMarkdown::unescape(trim(substr($valueLine, strlen(self::Label))));

        return $value === '' ? null : $value;
    }

    public static function count(?string $body): int
    {
        return count(self::blocks((string) $body));
    }

    public static function strip(?string $body): string
    {
        $body = (string) $body;

        foreach (array_reverse(self::blocks($body)) as [$text, $offset]) {
            $body = self::remove($body, $offset, strlen($text));
        }

        return $body;
    }

    /**
     * The body holding exactly one block with this estimate, or none when
     * the estimate is cleared.
     */
    public static function apply(?string $body, ?string $estimate): string
    {
        $body = (string) $body;

        if ($estimate === null) {
            return self::strip($body);
        }

        $block = self::render($estimate);
        $blocks = self::blocks($body);

        if ($blocks === []) {
            $trimmed = rtrim($body);

            return $trimmed === '' ? $block : "{$trimmed}\n\n{$block}";
        }

        foreach (array_reverse(array_slice($blocks, 1)) as [$text, $offset]) {
            $body = self::remove($body, $offset, strlen($text));
        }

        [$first, $offset] = $blocks[0];

        return substr_replace($body, $block, $offset, strlen($first));
    }

    public static function render(string $estimate): string
    {
        if (preg_match('/[\r\n]/', $estimate) === 1) {
            throw new InvalidArgumentException('An estimate label must be a single line.');
        }

        if (trim($estimate) === '' || in_array(trim($estimate), self::NeverWritten, true)) {
            throw new InvalidArgumentException('Only deck cards that are estimates can be written.');
        }

        return self::Open."\n".self::Label.' '.self::escape($estimate)."\n".self::Close;
    }

    public static function escape(string $label): string
    {
        return GitHubMarkdown::escape($label);
    }

    /**
     * Every block as [text, offset], found line by line so no body size can
     * exhaust a regex engine. A block runs from its opening marker line to
     * the next closing marker line; a marker line or marker-like line in
     * between abandons the opening, so an unclosed marker never swallows
     * user text or a later block.
     *
     * @return array<int, array{0: string, 1: int}>
     */
    private static function blocks(string $body): array
    {
        $lines = explode("\n", $body);
        $offsets = [];
        $offset = 0;

        foreach ($lines as $index => $line) {
            $offsets[$index] = $offset;
            $offset += strlen($line) + 1;
        }

        $last = count($lines) - 1;
        $blocks = [];
        $index = 0;

        while ($index < $last) {
            if (! self::isMarkerLine($lines[$index], self::Open, true)) {
                $index++;

                continue;
            }

            $open = $index;
            $index++;

            while ($index <= $last && ! self::startsWithMarker($lines[$index])) {
                $index++;
            }

            if ($index > $last) {
                break;
            }

            if (! self::isMarkerLine($lines[$index], self::Close, $index < $last)) {
                continue;
            }

            $end = $offsets[$index] + strlen(self::withoutCarriageReturn($lines[$index], $index < $last));
            $blocks[] = [substr($body, $offsets[$open], $end - $offsets[$open]), $offsets[$open]];
            $index++;
        }

        return $blocks;
    }

    /**
     * The marker alone on its line, blanks around it allowed; a carriage
     * return is part of the line break only when a line feed follows.
     */
    private static function isMarkerLine(string $line, string $marker, bool $hasLineFeed): bool
    {
        return trim(self::withoutCarriageReturn($line, $hasLineFeed), self::Blank) === $marker;
    }

    private static function startsWithMarker(string $line): bool
    {
        $line = ltrim($line, self::Blank);

        return str_starts_with($line, self::Open) || str_starts_with($line, self::Close);
    }

    private static function withoutCarriageReturn(string $line, bool $hasLineFeed): string
    {
        return $hasLineFeed && str_ends_with($line, "\r") ? substr($line, 0, -1) : $line;
    }

    /**
     * Drops the block and the blank line before it (the separator skrum
     * inserts), or the one after it when the block starts the body.
     */
    private static function remove(string $body, int $offset, int $length): string
    {
        $before = substr($body, 0, $offset);
        $after = substr($body, $offset + $length);

        foreach (["\r\n\r\n", "\n\n"] as $separator) {
            if (str_ends_with($before, $separator)) {
                return substr($before, 0, -strlen($separator)).$after;
            }

            if ($before === '' && str_starts_with($after, $separator)) {
                return substr($after, strlen($separator));
            }
        }

        return $before.$after;
    }
}
