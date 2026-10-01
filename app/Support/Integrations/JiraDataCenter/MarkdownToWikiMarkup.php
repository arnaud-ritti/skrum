<?php

namespace App\Support\Integrations\JiraDataCenter;

use App\Actions\Integrations\IssueDraft;

/**
 * Export bodies for Jira Server/Data Center (spec 8 §4.1): plain
 * paragraphs and the link back to skrum, with every wiki special of the
 * user's text backslash-escaped so it cannot format, link or embed.
 */
class MarkdownToWikiMarkup
{
    private const Specials = '{}\[\]*_\-+^~!|#';

    /**
     * `-` and `_` only format whole words, and escaping them would break
     * Jira's linking of bare URLs.
     */
    private const UrlSpecials = '{}\[\]*+^~!|#';

    private const BareUrl = '~(https?://\S+)~i';

    /**
     * A backslash of the user's text is kept, but never next to another
     * backslash: Jira reads `\\` as a line break.
     */
    public static function escape(string $text): string
    {
        $parts = preg_split(self::BareUrl, $text, -1, PREG_SPLIT_DELIM_CAPTURE);

        if ($parts === false) {
            return self::escapeSpecials($text, self::Specials);
        }

        $escaped = '';

        foreach ($parts as $index => $part) {
            $escaped .= self::escapeSpecials($part, $index % 2 === 1 ? self::UrlSpecials : self::Specials);
        }

        return $escaped;
    }

    public static function draft(IssueDraft $draft): string
    {
        $paragraphs = array_map(self::escape(...), $draft->lines);
        $paragraphs[] = self::escape($draft->origin)." [{$draft->link}]";

        return implode("\n\n", $paragraphs);
    }

    private static function escapeSpecials(string $text, string $specials): string
    {
        return (string) preg_replace_callback(
            '/\\\\(?=['.self::Specials.'\\\\]|\z)|['.$specials.']/',
            fn (array $match): string => $match[0] === '\\' ? "\\\u{200B}" : "\\{$match[0]}",
            $text,
        );
    }
}
