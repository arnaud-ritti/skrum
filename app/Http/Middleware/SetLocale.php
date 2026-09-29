<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->setLocale($this->resolveLocale($request));

        return $next($request);
    }

    private function resolveLocale(Request $request): string
    {
        /** @var array<int, string> $supportedLocales */
        $supportedLocales = config('skrum.locales');

        $userLocale = $request->user()?->locale;

        if (in_array($userLocale, $supportedLocales, true)) {
            return $userLocale;
        }

        $cookieLocale = $request->cookie('locale');

        if (in_array($cookieLocale, $supportedLocales, true)) {
            return $cookieLocale;
        }

        return $request->getPreferredLanguage($supportedLocales) ?? $supportedLocales[0];
    }
}
