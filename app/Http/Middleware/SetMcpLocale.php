<?php

namespace App\Http\Middleware;

use App\Mcp\McpGrant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetMcpLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var array<int, string> $supportedLocales */
        $supportedLocales = config('skrum.locales');

        $locale = McpGrant::bound() ? McpGrant::current()->user->locale : null;

        app()->setLocale(in_array($locale, $supportedLocales, true) ? $locale : 'en');

        return $next($request);
    }
}
