<?php

namespace App\Support;

class EmojiData
{
    /**
     * Where a session's screen fetches the emoji list, in the viewer's language.
     *
     * @return array{baseUrl: string, locale: string}
     */
    public static function location(): array
    {
        return [
            'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
            'locale' => Locales::supported(app()->getLocale()),
        ];
    }
}
