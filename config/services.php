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
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => rtrim((string) env('APP_URL', ''), '/').'/auth/google/callback',
    ],

    'gifs' => [
        'provider' => env('SKRUM_GIF_PROVIDER'),
        'key' => env('SKRUM_GIF_API_KEY'),
        'rating' => env('SKRUM_GIF_RATING', 'pg'),
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
