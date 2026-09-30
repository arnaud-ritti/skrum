<?php

namespace App\Mcp;

use App\Support\Llm\Llm;

enum McpFeature
{
    case Insights;
    case Trackers;

    /**
     * Trackers stays unavailable until spec 6 (integrations) ships the
     * tracker connections the four tracker tools read.
     */
    public function isAvailable(): bool
    {
        return match ($this) {
            self::Insights => app(Llm::class)->isConfigured(),
            self::Trackers => false,
        };
    }
}
