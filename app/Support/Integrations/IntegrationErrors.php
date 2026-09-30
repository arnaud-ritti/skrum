<?php

namespace App\Support\Integrations;

use Illuminate\Support\Str;

class IntegrationErrors
{
    private const MaxLength = 500;

    /**
     * @var array<string, string>
     */
    private const Patterns = [
        '#https://hooks\.slack\.com/\S+#i' => 'https://hooks.slack.com/***',
        '#bot\d+:[A-Za-z0-9_-]+#' => 'bot***',
        '#\bxox[a-z]-[A-Za-z0-9-]+#i' => 'xox***',
        '#\bBearer\s+[^\s,;"\']+#i' => 'Bearer ***',
        '#\b(access_token|refresh_token|client_secret|code)=[^&\s"\']+#i' => '$1=***',
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
