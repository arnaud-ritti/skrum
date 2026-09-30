<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ActionItemQuery;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Mcp\VisibleTeams;
use App\Models\ActionItem;
use App\Models\Team;
use Closure;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListActionItems extends SkrumTool
{
    protected string $name = 'retro.actions.list';

    protected string $description = 'List action items (agreements) across every board of your teams at once: open by default, or overdue, completed or all; optionally only yours, unassigned or a teammate\'s, and only one team or workspace. Overdue items come first, then by due date, priority and creation date.';

    public function __construct(
        private McpContext $context,
        private VisibleTeams $visibleTeams,
        private ActionItemQuery $actionItemQuery,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->description('Only this team (UUID).'),
            'workspace_id' => $schema->string()->description('Only the teams of this workspace (UUID).'),
            'status' => $schema->string()->enum(ActionItemFilters::Statuses)->default('open'),
            'assignee' => $schema->string()->description('"me", "unassigned" or a user id from retro.team.members.list.'),
            'limit' => $schema->integer()->min(1)->max(50)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['nullable', 'uuid'],
            'workspace_id' => ['nullable', 'uuid'],
            'status' => ['nullable', Rule::in(ActionItemFilters::Statuses)],
            'assignee' => ['nullable', 'string', function (string $attribute, mixed $value, Closure $fail): void {
                if (in_array($value, ['me', 'unassigned'], true) || Str::isUuid($value)) {
                    return;
                }

                $fail(__('Choose "me", "unassigned" or a member of the team.'));
            }],
            ...$this->paginationRules(),
        ]);

        $grant = McpGrant::current();
        $teamIds = $this->teamIds($grant, $validated['team_id'] ?? null, $validated['workspace_id'] ?? null);

        $query = ActionItem::query()
            ->whereIn('team_id', $teamIds)
            ->with(McpActionItem::relations())
            ->withCount('comments');

        $filters = new ActionItemFilters(
            status: $validated['status'] ?? 'open',
            assignee: $validated['assignee'] ?? null,
        );

        $query = ActionItemQuery::order($this->actionItemQuery->filter($query, $grant->user, $filters));

        [$page, $limit] = $this->pagination($validated);

        return Response::structured($this->paginate(
            $query,
            $page,
            $limit,
            fn (ActionItem $item) => $this->presentActionItem->handle($item, $grant->user),
        ));
    }

    /**
     * @return array<int, string>
     */
    private function teamIds(McpGrant $grant, ?string $teamId, ?string $workspaceId): array
    {
        if ($teamId !== null) {
            $team = $this->context->team($teamId);

            if ($workspaceId !== null && $team->workspace_id !== $workspaceId) {
                throw new ModelNotFoundException;
            }

            return [$team->id];
        }

        $visible = $this->visibleTeams->ids($grant);

        if ($workspaceId === null) {
            return $visible;
        }

        $inWorkspace = Team::query()->whereIn('id', $visible)->where('workspace_id', $workspaceId)->pluck('id')->all();

        if ($inWorkspace === []) {
            throw new ModelNotFoundException;
        }

        return $inWorkspace;
    }
}
