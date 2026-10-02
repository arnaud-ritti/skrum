<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
        'client_id' => env('SLACK_CLIENT_ID'),
        'client_secret' => env('SLACK_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/slack/callback',
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
    ],

    'jira' => [
        'client_id' => env('JIRA_CLIENT_ID'),
        'client_secret' => env('JIRA_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/jira/callback',
    ],

    'linear' => [
        'client_id' => env('LINEAR_CLIENT_ID'),
        'client_secret' => env('LINEAR_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/linear/callback',
        'webhook_secret' => env('LINEAR_WEBHOOK_SECRET'),
    ],

    'jira_dc' => [
        'base_url' => env('JIRA_DC_BASE_URL'),
        'client_id' => env('JIRA_DC_CLIENT_ID'),
        'client_secret' => env('JIRA_DC_CLIENT_SECRET'),
        'personal_tokens' => (bool) env('JIRA_DC_PERSONAL_TOKENS', true),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/jira-dc/callback',
    ],

    'github_app' => [
        'app_id' => env('GITHUB_APP_ID'),
        'slug' => env('GITHUB_APP_SLUG'),
        'client_id' => env('GITHUB_APP_CLIENT_ID'),
        'client_secret' => env('GITHUB_APP_CLIENT_SECRET'),
        'private_key' => str_replace('\n', "\n", (string) env('GITHUB_APP_PRIVATE_KEY', '')),
        'private_key_path' => env('GITHUB_APP_PRIVATE_KEY_PATH'),
        'webhook_secret' => env('GITHUB_APP_WEBHOOK_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/integrations/github/callback',
    ],

    'msteams' => [
        'enabled' => (bool) env('MSTEAMS_ENABLED', false),
        'allowed_hosts' => array_values(array_filter(array_map(
            fn (string $host): string => strtolower(trim($host)),
            explode(',', (string) env('MSTEAMS_ALLOWED_HOSTS', '')),
        ))),
    ],

    'mattermost' => [
        'url' => rtrim((string) env('MATTERMOST_URL', ''), '/'),
    ],

    'outgoing_webhooks' => [
        'enabled' => (bool) env('OUTGOING_WEBHOOKS_ENABLED', false),
        'allow_private_networks' => (bool) env('OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS', false),
        'allow_http' => (bool) env('OUTGOING_WEBHOOKS_ALLOW_HTTP', false),
    ],

    'integrations' => [
        'inbound_webhooks' => env('INTEGRATIONS_INBOUND_WEBHOOKS', 'auto'),
        'poll_minutes' => (int) env('INTEGRATIONS_POLL_MINUTES', 5),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/auth/google/callback',
    ],

    'gifs' => [
        'provider' => env('SKRUM_GIF_PROVIDER'),
        'key' => env('SKRUM_GIF_API_KEY'),
        'rating' => env('SKRUM_GIF_RATING', 'g'),
    ],

    'llm' => [
        'provider' => env('SKRUM_LLM_PROVIDER'),
        'key' => env('SKRUM_LLM_API_KEY'),
        'model' => env('SKRUM_LLM_MODEL'),
        'base_url' => env('SKRUM_LLM_BASE_URL'),
    ],

    'emoji_data' => [
        'version' => '17.0.0',
    ],

    'github' => [
        'client_id' => env('GITHUB_CLIENT_ID'),
        'client_secret' => env('GITHUB_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/auth/github/callback',
    ],

];
