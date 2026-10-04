<?php

namespace App\Support\Integrations;

use Illuminate\Support\Str;

class IntegrationErrors
{
    private const int MaxLength = 500;

    /**
     * @var array<string, string>
     */
    private const array Patterns = [
        '#https://hooks\.slack\.com/\S+#i' => 'https://hooks.slack.com/***',
        '#(https://[^\s/"\']+\.(?:logic\.azure\.com|api\.powerplatform\.com)(?::\d+)?)/[^\s"\']*#i' => '$1/***',
        '#(https?://[^\s"\']+?)/hooks/[A-Za-z0-9]+#i' => '$1/hooks/***',
        '#\bbot\d+:[A-Za-z0-9_-]+#' => 'bot***',
        '#\bxox[a-z]-[A-Za-z0-9-]+#i' => 'xox***',
        '#\b(https?://)[^\s/@"\']+@#i' => '$1***@',
        '#\bBearer\s+[^\s,;"\']+#i' => 'Bearer ***',
        '#\bBasic\s+[A-Za-z0-9+/=._-]+#i' => 'Basic ***',
        '#\b(access_token|refresh_token|client_secret|code|token|password|api_key)=[^&\s"\']+#i' => '$1=***',
        '#("(?:access_token|refresh_token|client_secret|code|token|password|api_key)"\s*:\s*")[^"]*#i' => '$1***',
        '#(/integrations/webhooks/jira(?:-dc)?/[0-9a-f-]{36}/)[A-Za-z0-9]{40}#i' => '$1***',
        '#(https?://[^\s?\#"\']+)[?\#][^\s"\']*#i' => '$1',
    ];

    public static function sanitize(string $message): string
    {
        $clean = $message;

        foreach (self::Patterns as $pattern => $replacement) {
            $clean = preg_replace($pattern, $replacement, $clean) ?? $clean;
        }

        return Str::limit(trim($clean), self::MaxLength - 3, '...');
    }
}
