<?php

use App\Http\Middleware\AuthenticateMcpRequest;
use App\Http\Middleware\EnsureMcpIsEnabled;
use App\Http\Middleware\SetMcpLocale;
use App\Mcp\Servers\SkrumServer;
use Laravel\Mcp\Facades\Mcp;
use Laravel\Mcp\Server\Middleware\AddWwwAuthenticateHeader;

if (config('skrum.mcp.enabled')) {
    Mcp::web('/mcp', SkrumServer::class)
        ->middleware([
            EnsureMcpIsEnabled::class,
            AuthenticateMcpRequest::class,
            SetMcpLocale::class,
            'throttle:mcp',
        ])
        ->withoutMiddleware(AddWwwAuthenticateHeader::class)
        ->name('mcp');
}
