<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\Tools\SkrumTool;
use App\Models\Team;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListTeams extends SkrumTool
{
    protected string $name = 'retro.teams.list';

    protected string $description = 'List the teams you can see, alphabetically, with their workspace, whether you are a member, and how many of their retrospective boards are finished or unfinished. Optionally filter by workspace_id. Paginated with limit and page.';

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'workspace_id' => $schema->string()->format('uuid')->description('Only teams of this workspace.'),
            'limit' => $schema->integer()->description('Items per page, 1 to 50 (default 20).'),
            'page' => $schema->integer()->description('Page number, starting at 1.'),
        ];
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'workspace_id' => ['nullable', 'uuid'],
            ...$this->paginationRules(),
        ]);

        [$page, $limit] = $this->pagination($validated);
        $user = $this->context()->user();

        $query = Team::query()
            ->select('teams.*')
            ->join('workspaces', 'workspaces.id', '=', 'teams.workspace_id')
            ->whereIn('teams.id', $this->context()->visibleTeamIds())
            ->when(isset($validated['workspace_id']), fn ($query) => $query->where('teams.workspace_id', $validated['workspace_id']))
            ->with('workspace')
            ->withExists(['members as is_member' => fn ($members) => $members->whereKey($user->id)])
            ->withCount([
                'retros as finished_boards_count' => fn ($retros) => $retros->where('phase', RetroPhase::Completed),
                'retros as unfinished_boards_count' => fn ($retros) => $retros->where('phase', '!=', RetroPhase::Completed),
            ])
            ->orderBy('teams.name')
            ->orderBy('workspaces.name')
            ->orderBy('teams.id');

        return Response::structured($this->paginate($query, $page, $limit, fn (Team $team): array => [
            'id' => $team->id,
            'name' => $team->name,
            'workspaceId' => $team->workspace_id,
            'workspaceName' => $team->workspace->name,
            'isMember' => (bool) $team->getAttribute('is_member'),
            'finishedBoards' => (int) $team->getAttribute('finished_boards_count'),
            'unfinishedBoards' => (int) $team->getAttribute('unfinished_boards_count'),
        ]));
    }
}
