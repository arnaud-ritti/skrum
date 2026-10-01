<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\PresentRetroSummary;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Tools\SkrumTool;
use App\Models\Participant;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetSummary extends SkrumTool
{
    protected string $name = 'retro.board.summary.get';

    protected string $description = 'Get the summary of a finished board and who took part. The summary is null while the board is not finished, while it is being generated, when the team turned it off or when no AI provider is configured. Participants are listed on anonymous boards too, never who wrote what.';

    public function __construct(
        private McpContext $context,
        private McpBoard $presentBoard,
        private PresentRetroSummary $presentRetroSummary,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);
        $presented = $this->presentRetroSummary->handle($retro);
        $status = $retro->effectiveSummaryStatus();
        $isReady = $retro->phase === RetroPhase::Completed
            && $retro->ai_summary_enabled
            && $presented !== null
            && $status === SummaryStatus::Ready;

        return Response::structured([
            'board' => $this->presentBoard->handle($retro),
            'summary' => $isReady ? [
                'text' => $presented['text'],
                'generatedAt' => $presented['generatedAt'],
                'provider' => $presented['provider'],
            ] : null,
            'summaryStatus' => $status?->value,
            'participants' => $retro->participants()->with('user')->oldest()->get()
                ->map(fn (Participant $participant): array => [
                    'name' => $participant->displayName(),
                    'avatarUrl' => url($participant->avatarUrl()),
                ])
                ->values()
                ->all(),
        ]);
    }
}
