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

        $acceptedLanguages = filled($request->header('Accept-Language')) ? $request->getLanguages() : [];

        foreach ($acceptedLanguages as $language) {
            $primaryLanguage = strtolower(strtok($language, '_-'));

            if (in_array($primaryLanguage, $supportedLocales, true)) {
                return $primaryLanguage;
            }
        }

        $defaultLocale = config('app.locale');

        return in_array($defaultLocale, $supportedLocales, true) ? $defaultLocale : 'en';
    }
}
