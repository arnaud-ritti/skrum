<?php

namespace App\Support\Integrations\JiraDataCenter;

/**
 * The one Jira Server/Data Center of this instance (spec 8 §2.1). Its key
 * identifies the server in `site()` and in imported references: the base
 * URL itself may be longer than the `external_site` columns.
 */
class JiraDataCenterServer
{
    private const int KeyLength = 40;

    public static function baseUrl(): string
    {
        return rtrim((string) config('services.jira_dc.base_url'), '/');
    }

    public static function key(?string $baseUrl = null): string
    {
        return substr(hash('sha256', rtrim($baseUrl ?? self::baseUrl(), '/')), 0, self::KeyLength);
    }

    public static function url(string $path): string
    {
        return self::baseUrl().'/'.ltrim($path, '/');
    }
}
