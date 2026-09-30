<?php

namespace App\Support\Integrations\Jira;

use App\Enums\IntegrationAccess;

class JiraClient
{
    public const ReadScopes = ['offline_access', 'read:jira-work', 'read:board-scope:jira-software', 'read:sprint:jira-software'];

    public const WriteScopes = ['write:jira-work', 'read:jira-user'];

    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? [...self::ReadScopes, ...self::WriteScopes] : self::ReadScopes;
    }
}
