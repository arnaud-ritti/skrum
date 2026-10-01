<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Spec 8 §4.4: an incoming webhook of the one configured Mattermost server.
 */
class MattermostWebhookUrl implements ValidationRule
{
    public static function serverUrl(): string
    {
        return rtrim((string) config('services.mattermost.url'), '/');
    }

    public static function isValid(mixed $url): bool
    {
        $server = self::serverUrl();

        if (! is_string($url) || $server === '') {
            return false;
        }

        return preg_match('#^'.preg_quote($server, '#').'/hooks/[A-Za-z0-9]{26}\\z#', $url) === 1;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::isValid($value)) {
            $fail(__('Use an incoming webhook of :url.', ['url' => self::serverUrl()]));
        }
    }
}
