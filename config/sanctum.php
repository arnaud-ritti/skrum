<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful domains and guards
    |--------------------------------------------------------------------------
    |
    | Sanctum only authenticates the MCP endpoint, and only through bearer
    | tokens: no stateful domain and no fallback guard, so a browser session
    | cookie never authenticates a token-protected route.
    |
    */

    'stateful' => [],

    'guard' => [],

    /*
    |--------------------------------------------------------------------------
    | Expiration
    |--------------------------------------------------------------------------
    |
    | Every token carries its own expires_at (chosen on creation), so there is
    | no global lifetime.
    |
    */

    'expiration' => null,

    /*
    |--------------------------------------------------------------------------
    | Token prefix
    |--------------------------------------------------------------------------
    |
    | Makes leaked skrum tokens detectable by secret scanners.
    |
    */

    'token_prefix' => 'skrum_',

];
