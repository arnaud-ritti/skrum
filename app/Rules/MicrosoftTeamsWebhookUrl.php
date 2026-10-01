<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Spec 8 §4.3: a Teams Workflows webhook, checked on save and before each send.
 */
class MicrosoftTeamsWebhookUrl implements ValidationRule
{
    private const MaxLength = 2048;

    /**
     * @var array<int, string>
     */
    private const HostSuffixes = ['.logic.azure.com', '.api.powerplatform.com'];

    public static function isValid(mixed $url): bool
    {
        if (! is_string($url) || strlen($url) > self::MaxLength || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https') {
            return false;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        if (($parts['port'] ?? 443) !== 443) {
            return false;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));

        if (in_array($host, (array) config('services.msteams.allowed_hosts', []), true)) {
            return true;
        }

        foreach (self::HostSuffixes as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return true;
            }
        }

        return false;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! self::isValid($value)) {
            $fail(__('Use the workflow URL from Microsoft Teams.'));
        }
    }
}
