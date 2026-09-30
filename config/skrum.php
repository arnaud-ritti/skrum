<?php

return [
    'locales' => ['en', 'fr', 'es', 'de'],

    'signup_mode' => env('SKRUM_SIGNUP_MODE', 'invite'),

    'allowed_email_domains' => array_values(array_filter(array_map(
        fn (string $domain) => strtolower(trim($domain)),
        explode(',', (string) env('SKRUM_ALLOWED_EMAIL_DOMAINS', '')),
    ))),

    'avatar_style' => env('SKRUM_AVATAR_STYLE', 'thumbs'),

    'action_item_reminders' => [
        'enabled' => (bool) env('SKRUM_ACTION_ITEM_REMINDERS', true),
        'time' => env('SKRUM_ACTION_ITEM_REMINDER_TIME', '08:00'),
    ],

    'trusted_proxies' => env('TRUSTED_PROXIES'),
];
