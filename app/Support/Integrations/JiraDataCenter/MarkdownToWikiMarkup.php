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
    public static function escape(string $text): string
    {
        return (string) preg_replace('/([\\\\{}\[\]*_\-+^~!|#])/', '\\\\$1', $text);
    }

    public static function draft(IssueDraft $draft): string
    {
        $paragraphs = array_map(self::escape(...), $draft->lines);
        $paragraphs[] = self::escape($draft->origin)." [{$draft->link}]";

        return implode("\n\n", $paragraphs);
    }
}
