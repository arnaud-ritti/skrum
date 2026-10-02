<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\PresentSuggestedAction;
use App\Actions\Retros\PromoteSuggestedAction;
use App\Actions\Retros\SuggestionGuard;
use App\Enums\McpFeature;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpActionItem;
use App\Mcp\Tools\SkrumTool;
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
class PromoteSuggestion extends SkrumTool
{
    protected string $name = 'retro.board.suggested_actions.promote';

    protected string $description = 'Turn a suggested action of a retrospective into an action item, keeping its wording and theme. While the board is in the Discussing, Actions or ROTI phase any participant may do it (not while locked); once completed only its facilitator or a workspace admin. Each suggestion can be handled once.';

    public function __construct(
        private McpContext $context,
        private SuggestionGuard $suggestionGuard,
        private PromoteSuggestedAction $promoteSuggestedAction,
        private PresentSuggestedAction $presentSuggestedAction,
        private McpActionItem $presentActionItem,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->format('uuid')->required(),
            'suggested_action_id' => $schema->string()->format('uuid')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'board_id' => ['required', 'uuid'],
            'suggested_action_id' => ['required', 'uuid'],
        ]);

        $retro = $this->context->retro((string) $validated['board_id']);
        $retro->suggestedActions()->whereKey($validated['suggested_action_id'])->firstOrFail();

        $this->suggestionGuard->authorizeUser($retro, McpGrant::current()->user, $this->context->participant($retro));

        $participant = $this->context->participantForWrite($retro);

        [$suggestion, $actionItem] = DB::transaction(function () use ($retro, $validated, $participant): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->suggestedActions()->whereKey($validated['suggested_action_id'])->firstOrFail();

            return [$fresh, $this->promoteSuggestedAction->handle($locked, $fresh, $participant)];
        });

        return Response::structured([
            'suggestedAction' => $this->presentSuggestedAction->handle($suggestion),
            'actionItem' => $this->presentActionItem->handle($actionItem, McpGrant::current()->user),
        ]);
    }
}
