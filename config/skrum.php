<?php

return [
    'demo' => [
        'enabled' => (bool) env('SKRUM_DEMO', false),
        'reset_time' => env('SKRUM_DEMO_RESET_TIME', '03:00'),
    ],

    'locales' => ['en', 'fr', 'es', 'de'],

    'version' => env('SKRUM_VERSION', '0.0.3'),

    'licence' => 'AGPL-3.0-or-later',

    'licence_url' => 'https://github.com/arnaud-ritti/skrum/blob/main/LICENSE',

    'repository_url' => 'https://github.com/arnaud-ritti/skrum',

    'image' => 'ghcr.io/arnaud-ritti/skrum',

    'update_check_enabled' => (bool) env('SKRUM_UPDATE_CHECK_ENABLED', true),

    'update_feed' => env('SKRUM_UPDATE_FEED', 'https://api.github.com/repos/arnaud-ritti/skrum/releases/latest'),

    'require_email_verification' => (bool) env('SKRUM_REQUIRE_EMAIL_VERIFICATION', true),

    'signup_mode' => env('SKRUM_SIGNUP_MODE', 'invite'),

    'allowed_email_domains' => array_values(array_filter(array_map(
        fn (string $domain): string => strtolower(trim($domain)),
        explode(',', (string) env('SKRUM_ALLOWED_EMAIL_DOMAINS', '')),
    ))),

    'avatar_style' => env('SKRUM_AVATAR_STYLE', 'thumbs'),

    'action_item_reminders' => [
        'enabled' => (bool) env('SKRUM_ACTION_ITEM_REMINDERS', true),
        'time' => env('SKRUM_ACTION_ITEM_REMINDER_TIME', '08:00'),
    ],

    'mcp' => [
        'enabled' => (bool) env('SKRUM_MCP_ENABLED', true),
        'rate_limit' => (int) env('SKRUM_MCP_RATE_LIMIT', 120),
        'write_rate_limit' => (int) env('SKRUM_MCP_WRITE_RATE_LIMIT', 30),
    ],

    'passwords' => [
        'breach_check' => (bool) env('SKRUM_PASSWORD_BREACH_CHECK', true),
        'breach_check_timeout' => (int) env('SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT', 5),
    ],

    'trusted_proxies' => env('TRUSTED_PROXIES', '*'),
];
