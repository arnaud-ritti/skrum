<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AssignRequestId
{
    public const Header = 'X-Request-Id';

    public const ContextKey = 'request_id';

    public function handle(Request $request, Closure $next): Response
    {
        $requestId = (string) Str::uuid();

        Context::add(self::ContextKey, $requestId);

        $response = $next($request);

        $response->headers->set(self::Header, $requestId);

        return $response;
    }
}
