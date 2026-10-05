<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Integrations\ImportPokerTasks;
use App\Actions\Integrations\PreviewPokerImport;
use App\Actions\Poker\PokerGuard;
use App\Enums\IntegrationProvider;
use App\Enums\McpFeature;
use App\Enums\McpScope;
use App\Mcp\Concerns\ResolvesTracker;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld]
class ImportTasks extends SkrumTool
{
    use ResolvesTracker;

    protected string $name = 'poker.game.tasks.import';

    protected string $description = 'Import the issues of a tracker iteration (iteration_id: a Jira sprint, Linear cycle or GitHub milestone) or of a query (query: JQL for Jira, a search term for Linear or GitHub) into a planning poker game, in source order, at most 100 per call. GitHub queries need container_id (the repository). Issues already imported are skipped; a game holds at most 200 tasks.';

    public function __construct(
        private McpContext $context,
        private ImportPokerTasks $importPokerTasks,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'game_id' => $schema->string()->format('uuid')->required(),
            'source' => $schema->string()->enum(IntegrationProvider::trackerValues())->required(),
            'iteration_id' => $schema->string()->max(100),
            'container_id' => $schema->string()->max(100)->description('The GitHub repository id for a query; accepted for Jira sprints, not needed.'),
            'query' => $schema->string()->min(1)->max(1000),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Trackers;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'game_id' => ['required', 'uuid'],
            'source' => ['required', 'string', Rule::in(IntegrationProvider::trackerValues())],
            'iteration_id' => ['nullable', 'string', 'max:100', 'required_without:query', 'prohibits:query'],
            'container_id' => [
                'nullable',
                'string',
                'max:100',
                Rule::requiredIf(fn (): bool => $request->get('source') === 'github' && blank($request->get('iteration_id'))),
            ],
            'query' => ['nullable', 'string', 'max:1000', 'required_without:iteration_id'],
        ]);

        $game = $this->context->pokerGame((string) $validated['game_id']);

        $this->refuseObserver($game->team);

        PokerGuard::notEnded($game);

        $integration = $this->trackerFor($game->team, (string) $validated['source']);
        $player = $this->context->pokerPlayerForWrite($game);

        TrackerBrowseLimit::hit($this->context->user()->id);

        $iterationId = filled($validated['iteration_id'] ?? null) ? (string) $validated['iteration_id'] : null;

        return Response::structured($this->importPokerTasks->fromSource(
            $game,
            $player,
            $integration,
            $iterationId === null ? PreviewPokerImport::ModeQuery : PreviewPokerImport::ModeIteration,
            $iterationId,
            $validated['query'] ?? null,
            $validated['container_id'] ?? null,
        ));
    }
}
