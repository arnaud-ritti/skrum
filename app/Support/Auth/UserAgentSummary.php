<?php

namespace App\Support\Auth;

class UserAgentSummary
{
    /** @var array<string, string> Order matters: Edge and Opera also say Chrome, Chrome also says Safari. */
    private const array Browsers = ['Edg/' => 'Edge', 'OPR/' => 'Opera', 'Firefox/' => 'Firefox', 'Chrome/' => 'Chrome', 'Safari/' => 'Safari'];

    /** @var array<string, string> Order matters: iOS devices also say Mac OS X, Android also says Linux. */
    private const array Systems = ['iPhone' => 'iOS', 'iPad' => 'iOS', 'Android' => 'Android', 'Windows' => 'Windows', 'Mac OS X' => 'macOS', 'Linux' => 'Linux'];

    /** @var array<int, string> */
    private const array PhoneNeedles = ['iPhone', 'iPad', 'Android'];

    /**
     * Only labels of this class leave it: no part of the header is copied.
     */
    public static function describe(?string $userAgent): ?string
    {
        if ($userAgent === null) {
            return null;
        }

        $browser = self::firstLabel(self::Browsers, $userAgent);
        $system = self::firstLabel(self::Systems, $userAgent);

        if ($browser === null || $system === null) {
            return null;
        }

        return __(':browser on :system', ['browser' => $browser, 'system' => $system]);
    }

    public static function deviceKind(?string $userAgent): string
    {
        if ($userAgent === null) {
            return 'unknown';
        }

        if (self::firstLabel(self::Systems, $userAgent) === null) {
            return 'unknown';
        }

        foreach (self::PhoneNeedles as $needle) {
            if (str_contains($userAgent, $needle)) {
                return 'phone';
            }
        }

        return 'desktop';
    }

    /**
     * @param  array<string, string>  $labels
     */
    private static function firstLabel(array $labels, string $userAgent): ?string
    {
        foreach ($labels as $needle => $label) {
            if (str_contains($userAgent, $needle)) {
                return $label;
            }
        }

        return null;
    }
}
