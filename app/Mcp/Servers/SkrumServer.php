<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListTeamMembers;
use App\Mcp\Tools\Retro\ListTeams;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('skrum')]
#[Instructions(<<<'MARKDOWN'
    skrum is a self-hosted tool for agile team rituals.
    Teams belong to workspaces. Each team runs retrospective boards; a board holds messages (cards) in template columns,
    moves through phases (health check, icebreaker, writing, grouping, voting, discussing, completed) and ends with
    action items (agreements), a health check score and a ROTI rating. Teams also run planning poker games: a game holds
    tasks, and each task is estimated in rounds of hidden votes that the facilitator reveals.
    Content that the user cannot see on a board (hidden cards, anonymous authors, unrevealed votes) is never returned.
    MARKDOWN)]
class SkrumServer extends Server
{
    public int $defaultPaginationLength = 50;

    protected array $tools = [
        ListTeams::class,
        ListTeamMembers::class,
        ListBoards::class,
        ListActionItems::class,
        ListBoardActionItems::class,
    ];

    protected array $resources = [];

    protected array $prompts = [];

    protected function boot(): void
    {
        $this->version = (string) config('skrum.version');
    }
}
