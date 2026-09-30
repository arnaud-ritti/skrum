<?php

namespace App\Mcp;

use App\Support\Llm\Llm;

enum McpFeature
{
    case Insights;
    case Trackers;

    public function isAvailable(): bool
    {
        return match ($this) {
            self::Insights => app(Llm::class)->isConfigured(),
            self::Trackers => app(McpTrackers::class)->available(),
        };
    }
}
