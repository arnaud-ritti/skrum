<?php

namespace App\Support\Integrations\Messages;

class SlackText
{
    public const SectionLimit = 3000;

    public const HeaderLimit = 150;

    public const ButtonLimit = 75;

    /**
     * Slack reads `<…>` as mentions and links and `&` as an entity, so user
     * text escaped this way can never ping a channel or hide a link.
     */
    public static function escape(string $text): string
    {
        return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $text);
    }
}
