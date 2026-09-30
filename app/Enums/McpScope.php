<?php

namespace App\Enums;

enum McpScope: string
{
    case Read = 'mcp:read';
    case Write = 'mcp:write';
    case Delete = 'mcp:delete';

    public function label(): string
    {
        return match ($this) {
            self::Read => __('Read'),
            self::Write => __('Create and update'),
            self::Delete => __('Delete my messages'),
        };
    }
}
