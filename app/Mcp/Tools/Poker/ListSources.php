<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\ListPokerSources;
use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld]
class ListSources extends SkrumTool
{
    protected string $name = 'poker.sources.list';

    protected string $description = 'List the issue trackers (Jira, Jira Data Center, Linear, GitHub) connected to a team for planning poker, with their status, whether tasks can be imported and estimates written back (GitHub: into the issue description, for every deck), and whether status sync is on. Chat channels, credentials and provider errors are never returned.';

    public function __construct(
        private McpContext $context,
        private ListPokerSources $listPokerSources,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
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
        $validated = $request->validate(['team_id' => ['required', 'uuid']]);

        $team = $this->context->team((string) $validated['team_id']);

        return Response::structured(['items' => $this->listPokerSources->handle($team)]);
    }
}
