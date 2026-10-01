<?php

namespace App\Enums;

use App\Mcp\McpTrackers;
use App\Support\Llm\Llm;

enum McpFeature
{
    case Insights;
    case Trackers;

    public function isAvailable(): bool
    {
        return match ($this) {
            self::Insights => resolve(Llm::class)->isConfigured(),
            self::Trackers => resolve(McpTrackers::class)->available(),
        };
    }
}
