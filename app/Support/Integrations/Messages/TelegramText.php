<?php

namespace App\Support\Integrations\Messages;

class TelegramText
{
    public const MessageLimit = 4096;

    /**
     * Telegram's HTML mode knows only a few named entities, so quotes are
     * written as numeric ones (ENT_HTML401).
     */
    public static function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML401, 'UTF-8');
    }
}
