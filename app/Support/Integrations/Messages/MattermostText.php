<?php

namespace App\Support\Integrations\Messages;

class MattermostText
{
    public const MessageLimit = 16000;

    private const string Specials = '\\*_[]()#>~|<`';

    /**
     * A zero-width space after "@" and "~" keeps user text from mentioning
     * people or channels (@channel, @here, ~town-square).
     */
    public static function escape(string $text): string
    {
        return str_replace(['@', '~'], ["@\u{200B}", "~\u{200B}"], MarkdownText::escape($text, self::Specials));
    }

    public static function link(string $label, string $url): string
    {
        return '['.self::escape($label).']('.str_replace(['(', ')', ' '], ['%28', '%29', '%20'], $url).')';
    }
}
