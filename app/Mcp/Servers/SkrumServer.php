<?php

namespace App\Mcp\Servers;

use App\Mcp\Prompts\AnalyzeRetro;
use App\Mcp\Prompts\TeamHealth;
use App\Mcp\Tools\Poker\AddTasks;
use App\Mcp\Tools\Poker\CreateGame;
use App\Mcp\Tools\Poker\GetGame;
use App\Mcp\Tools\Poker\ImportTasks;
use App\Mcp\Tools\Poker\ListGames;
use App\Mcp\Tools\Poker\ListIterations;
use App\Mcp\Tools\Poker\ListSources;
use App\Mcp\Tools\Poker\ListTasks;
use App\Mcp\Tools\Poker\RevealTask;
use App\Mcp\Tools\Poker\SelectTask;
use App\Mcp\Tools\Poker\SyncTask;
use App\Mcp\Tools\Retro\CompleteAction;
use App\Mcp\Tools\Retro\CreateAction;
use App\Mcp\Tools\Retro\DeleteOwnMessage;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use App\Mcp\Tools\Retro\ListTeamMembers;
use App\Mcp\Tools\Retro\ListTeams;
use App\Mcp\Tools\Retro\PromoteSuggestion;
use App\Mcp\Tools\Retro\RejectSuggestion;
use App\Mcp\Tools\Retro\SearchBoards;
use App\Mcp\Tools\Retro\UpdateAction;
use App\Mcp\Tools\Retro\UpdateMessage;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('skrum')]
#[Instructions(<<<'MARKDOWN'
    skrum is a self-hosted tool for agile team rituals.
    Teams belong to workspaces. Each team runs retrospective boards; a board holds messages (cards) in template columns,
    moves through phases (icebreaker, writing, grouping, voting, discussing, actions, roti, completed) and can carry a health
    check, a short survey the team answers during the board, scored 1 to 5. A board ends with action items (agreements),
    a health check score and a ROTI rating. Teams also run planning poker games: a game holds
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
        ListMessages::class,
        GetSummary::class,
        SearchBoards::class,
        ListInsights::class,
        GetHealth::class,
        GetRoti::class,
        CreateAction::class,
        UpdateAction::class,
        CompleteAction::class,
        PromoteSuggestion::class,
        RejectSuggestion::class,
        UpdateMessage::class,
        DeleteOwnMessage::class,
        ListGames::class,
        GetGame::class,
        ListTasks::class,
        CreateGame::class,
        AddTasks::class,
        SelectTask::class,
        RevealTask::class,
        ListSources::class,
        ListIterations::class,
        ImportTasks::class,
        SyncTask::class,
    ];

    protected array $resources = [];

    protected array $prompts = [
        AnalyzeRetro::class,
        TeamHealth::class,
    ];

    protected function boot(): void
    {
        $this->version = (string) config('skrum.version');
    }
}
