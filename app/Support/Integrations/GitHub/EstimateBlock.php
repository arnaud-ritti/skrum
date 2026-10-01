<?php

namespace App\Support\Integrations\GitHub;

use InvalidArgumentException;
use RuntimeException;

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

    private const BlockPattern = '~^[ \t]*<!-- skrum:estimate -->[ \t]*\r?\n(?:(?!^[ \t]*<!-- /?skrum:estimate -->)[^\n]*\n)*?^[ \t]*<!-- /skrum:estimate -->[ \t]*(?=\r?\n|\z)~m';

    private const ValuePattern = '~\A[^\n]*\n[ \t]*\*\*Estimate:\*\*([^\n]*?)[ \t]*\r?(?:\n|\z)~';

    private const Specials = '\\\\*_\[\]()#<>~|`&';

    public static function value(?string $body): ?string
    {
        $blocks = self::blocks((string) $body);

        if ($blocks === [] || preg_match(self::ValuePattern, $blocks[0][0], $match) !== 1) {
            return null;
        }

        $unescaped = (string) preg_replace('/\\\\(['.self::Specials.'])/', '$1', trim($match[1]));
        $value = str_replace("@\u{200B}", '@', $unescaped);

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
        $escaped = (string) preg_replace('/(['.self::Specials.'])/', '\\\\$1', $label);

        return str_replace('@', "@\u{200B}", $escaped);
    }

    /**
     * @return array<int, array{0: string, 1: int}>
     */
    private static function blocks(string $body): array
    {
        if (preg_match_all(self::BlockPattern, $body, $matches, PREG_OFFSET_CAPTURE) === false) {
            throw new RuntimeException('Could not scan the issue body for the estimate block: '.preg_last_error_msg());
        }

        return $matches[0];
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
