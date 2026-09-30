<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\Retros\RetroGuard;
use App\Enums\ActionItemPriority;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
use App\Models\ActionItem;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class CreateAction extends SkrumTool
{
    protected string $name = 'retro.actions.create';

    protected string $description = 'Create an action item (agreement). Pass board_id to add it to a retrospective (only while the board is in the Discussing phase and not locked; the item is created under your name even on anonymous boards), or team_id to add it to a team outside any retrospective. Assign a team member with assignee_user_id, or a guest of that board with assignee_participant_id.';

    public function __construct(
        private McpContext $context,
        private CreateActionItem $createActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
        private ActionItemPermissions $permissions,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->format('uuid')->description('The retrospective to add the item to. Exactly one of board_id or team_id.'),
            'team_id' => $schema->string()->format('uuid')->description('The team to add the item to, outside any retrospective. Exactly one of board_id or team_id.'),
            'content' => $schema->string()->min(1)->max(500)->description('What was agreed.')->required(),
            'priority' => $schema->string()->enum(array_column(ActionItemPriority::cases(), 'value'))->description('Priority, medium by default.'),
            'due_on' => $schema->string()->format('date')->description('Due date, YYYY-MM-DD.'),
            'assignee_user_id' => $schema->string()->format('uuid')->description('A member of the team (see retro.team.members.list).'),
            'assignee_participant_id' => $schema->string()->format('uuid')->description('A guest participant of the board (board_id only).'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $target = $request->validate([
            'board_id' => ['required_without:team_id', 'prohibits:team_id', 'nullable', 'uuid'],
            'team_id' => ['required_without:board_id', 'nullable', 'uuid'],
        ]);

        $item = ($target['board_id'] ?? null) !== null
            ? $this->onBoard($request, (string) $target['board_id'])
            : $this->onTeam($request, (string) $target['team_id']);

        return Response::structured($this->presentActionItem->handle($item, McpGrant::current()->user));
    }

    private function onBoard(Request $request, string $boardId): ActionItem
    {
        $validated = $request->validate(ActionItemRules::create(allowsGuests: true), ActionItemRules::messages());
        $retro = $this->context->retro($boardId);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        $actor = ActionItemActor::forParticipant($this->context->participantForWrite($retro));

        return DB::transaction(function () use ($retro, $actor, $validated): ActionItem {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            return $this->createActionItem->handle($locked->team, $locked, $actor, [
                ...ActionItemRules::attributes($validated),
                ...($this->resolveActionItemAssignee->handle($locked->team, $locked, $validated) ?? []),
            ]);
        });
    }

    private function onTeam(Request $request, string $teamId): ActionItem
    {
        $validated = $request->validate(ActionItemRules::create(allowsGuests: false), ActionItemRules::messages());
        $team = $this->context->team($teamId);
        $user = McpGrant::current()->user;

        $this->permissions->authorizeCreateWithoutRetro($user, $team);

        return DB::transaction(fn (): ActionItem => $this->createActionItem->handle($team, null, ActionItemActor::forUser($user), [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($team, null, $validated) ?? []),
        ]));
    }
}
