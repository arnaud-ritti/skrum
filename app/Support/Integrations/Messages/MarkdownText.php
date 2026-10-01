<?php

namespace App\Support\Integrations\Messages;

class MarkdownText
{
    /**
     * Backslash-escapes the given characters and any leading list marker
     * ("-", "+", "1."), so user text cannot format, link or start a list.
     */
    public static function escape(string $text, string $specials): string
    {
        $escaped = preg_replace('/(['.preg_quote($specials, '/').'])/u', '\\\\$1', $text) ?? $text;
        $escaped = preg_replace('/^(\s*)([-+])/mu', '$1\\\\$2', $escaped) ?? $escaped;

        return preg_replace('/^(\s*\d+)\./mu', '$1\\\\.', $escaped) ?? $escaped;
    }
}
