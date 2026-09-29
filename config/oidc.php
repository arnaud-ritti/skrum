<?php

return [

    'driver_prefix' => 'oidc_',

    'connections' => [

        'entra' => [
            'provider' => 'entra',
            'tenant' => env('ENTRA_TENANT', 'common'),
            'client_id' => env('ENTRA_CLIENT_ID'),
            'client_secret' => env('ENTRA_CLIENT_SECRET'),
            'redirect' => env('APP_URL').'/auth/entra/callback',
        ],

        'generic' => [
            'base_url' => env('OIDC_BASE_URL'),
            'client_id' => env('OIDC_CLIENT_ID'),
            'client_secret' => env('OIDC_CLIENT_SECRET'),
            'redirect' => env('APP_URL').'/auth/oidc/callback',
            'label' => env('OIDC_LABEL'),
        ],

    ],

];
