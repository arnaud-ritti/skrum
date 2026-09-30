<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\User;
use App\Models\WorkspaceMembership;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListTeamMembers extends SkrumTool
{
    protected string $name = 'retro.team.members.list';

    protected string $description = 'List the members of a team with their permission (owner, admin or member). Their user ids are the valid assignee_user_id values for action items.';

    public function __construct(private McpContext $context) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->description('The team id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['team_id' => ['required', 'uuid']]);
        $team = $this->context->team($validated['team_id']);
        $members = $team->members()->orderBy('name')->get();
        $roles = WorkspaceMembership::query()
            ->where('workspace_id', $team->workspace_id)
            ->whereIn('user_id', $members->pluck('id'))
            ->get()
            ->mapWithKeys(fn (WorkspaceMembership $membership) => [$membership->user_id => $membership->role->value]);

        return Response::structured([
            'members' => $members->map(fn (User $member) => [
                'userId' => $member->id,
                'name' => $member->name,
                'avatarUrl' => url($member->avatarUrl()),
                'permission' => $roles->get($member->id, 'member'),
            ])->values()->all(),
        ]);
    }
}
