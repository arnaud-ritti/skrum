<?php

namespace App\Support\Integrations\GitHub;

/**
 * User text placed in a GitHub issue body: Markdown and HTML characters
 * are backslash-escaped and line indents dropped (no list, heading or code block), and a zero-width space follows every `@` and every
 * `#` before a digit, so the text neither mentions people or teams nor
 * references issues. Bare URLs are still autolinked by GitHub.
 */
class GitHubMarkdown
{
    public const Specials = '\\\\*_\[\]()#<>~|`&';

    private const string ZeroWidthSpace = "\u{200B}";

    public static function escape(string $text): string
    {
        $escaped = (string) preg_replace('/^[ \t]+/m', '', $text);
        $escaped = (string) preg_replace('/(['.self::Specials.'])/', '\\\\$1', $escaped);
        $escaped = (string) preg_replace(['/^([-+=])/m', '/^(\d+)\./m'], ['\\\\$1', '$1\\\\.'], $escaped);
        $escaped = (string) preg_replace('/\\\\#(?=\d)/', '\\\\#'.self::ZeroWidthSpace, $escaped);

        return str_replace('@', '@'.self::ZeroWidthSpace, $escaped);
    }

    public static function unescape(string $text): string
    {
        $text = str_replace(['@'.self::ZeroWidthSpace, '#'.self::ZeroWidthSpace], ['@', '#'], $text);

        $text = (string) preg_replace(['/^\\\\([-+=])/m', '/^(\d+)\\\\\./m'], ['$1', '$1.'], $text);

        return (string) preg_replace('/\\\\(['.self::Specials.'])/', '$1', $text);
    }
}
