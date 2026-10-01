<?php

namespace App\Mcp;

/**
 * The `source` values of every MCP tracker tool (spec 8 §7.1): trackers
 * only, never chat channels.
 */
class PokerTrackerSources
{
    public const Values = ['jira', 'jira_dc', 'linear', 'github'];
}
