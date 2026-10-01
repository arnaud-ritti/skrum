<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\ListPokerIterations;
use App\Enums\McpScope;
use App\Mcp\Concerns\ResolvesTracker;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\PokerTrackerSources;
use App\Mcp\Tools\SkrumTool;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld]
class ListIterations extends SkrumTool
{
    use ResolvesTracker;

    protected string $name = 'poker.iterations.list';

    protected string $description = 'Without container_id, list the first 50 containers of a connected tracker (Jira boards, Linear teams, GitHub repositories). With container_id, list its active and upcoming iterations (Jira sprints, Linear cycles, GitHub open milestones).';

    public function __construct(
        private McpContext $context,
        private ListPokerIterations $listPokerIterations,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
            'source' => $schema->string()->enum(PokerTrackerSources::Values)->required(),
            'container_id' => $schema->string()->max(100)->description('A Jira board id, a Linear team id or a GitHub repository id.'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'team_id' => ['required', 'uuid'],
            'source' => ['required', 'string', Rule::in(PokerTrackerSources::Values)],
            'container_id' => ['nullable', 'string', 'max:100'],
        ]);

        $team = $this->context->team((string) $validated['team_id']);
        $integration = $this->trackerFor($team, (string) $validated['source']);

        TrackerBrowseLimit::hit($this->context->user()->id);

        return Response::structured($this->listPokerIterations->handle($integration, $validated['container_id'] ?? null));
    }
}
