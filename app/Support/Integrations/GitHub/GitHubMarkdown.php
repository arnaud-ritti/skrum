<?php

namespace App\Support\Integrations\GitHub;

/**
 * User text placed in a GitHub issue body: Markdown and HTML characters
 * are backslash-escaped, and a zero-width space follows every `@` and every
 * `#` before a digit, so the text neither mentions people or teams nor
 * references issues. Bare URLs are still autolinked by GitHub.
 */
class GitHubMarkdown
{
    public const Specials = '\\\\*_\[\]()#<>~|`&';

    private const ZeroWidthSpace = "\u{200B}";

    public static function escape(string $text): string
    {
        $escaped = (string) preg_replace('/(['.self::Specials.'])/', '\\\\$1', $text);
        $escaped = (string) preg_replace('/\\\\#(?=\d)/', '\\\\#'.self::ZeroWidthSpace, $escaped);

        return str_replace('@', '@'.self::ZeroWidthSpace, $escaped);
    }

    public static function unescape(string $text): string
    {
        $text = str_replace(['@'.self::ZeroWidthSpace, '#'.self::ZeroWidthSpace], ['@', '#'], $text);

        return (string) preg_replace('/\\\\(['.self::Specials.'])/', '$1', $text);
    }
}
