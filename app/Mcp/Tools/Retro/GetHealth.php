<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\HealthCheck\PresentHealthStatement;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetHealth extends SkrumTool
{
    protected string $name = 'retro.board.health.get';

    protected string $description = 'Get the team health check of a board: while collecting, who answered and your own scores; once the board is finished, the average per category (0–10), the overall score, alignment, strongest and weakest categories and the trend over the team\'s last boards. Individual scores of others are never returned.';

    public function __construct(
        private McpContext $context,
        private PresentHealthProgress $presentHealthProgress,
        private PresentHealthStatement $presentHealthStatement,
        private SummarizeHealthCheck $summarizeHealthCheck,
        private BuildHealthTrend $buildHealthTrend,
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

        if ($retro->phase === RetroPhase::HealthCheck) {
            return Response::structured($this->inProgress($retro));
        }

        if (! $retro->healthCheckAnswers()->exists()) {
            return Response::structured(['status' => 'not_run']);
        }

        if ($retro->phase !== RetroPhase::Completed) {
            return Response::structured([
                'status' => 'collected',
                'respondents' => $retro->healthCheckAnswers()->distinct()->count('participant_id'),
            ]);
        }

        $summary = $this->summarizeHealthCheck->handle($retro);

        if ($summary === null) {
            return Response::structured(['status' => 'not_run']);
        }

        return Response::structured([
            'status' => 'completed',
            'categories' => collect($summary['statements'])->map(fn (array $statement): array => [
                'key' => $statement['key'],
                'label' => $statement['label'],
                'average' => $statement['average'],
                'answers' => $statement['count'],
                'alignment' => $statement['consensus'],
            ])->values()->all(),
            'score' => $summary['score'],
            'alignment' => $summary['alignment']['value'],
            'alignmentLevel' => $summary['alignment']['level'],
            'turnout' => $summary['participation'],
            'topStrength' => $summary['topStrength'],
            'growthArea' => $summary['growthArea'],
            'assessment' => $summary['assessment'],
            'trend' => collect($this->buildHealthTrend->handle($retro))->map(fn (array $point): array => [
                'boardId' => $point['retroId'],
                'title' => $point['title'],
                'completedAt' => $point['completedAt'],
                'score' => $point['score'],
                'delta' => $point['delta'],
                'sameStatements' => $point['sameStatements'],
                'url' => $point['url'],
            ])->values()->all(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function inProgress(Retro $retro): array
    {
        $names = $retro->participants()->with('user')->get()->mapWithKeys(fn (Participant $participant): array => [$participant->id => $participant->displayName()]);
        $progress = collect($this->presentHealthProgress->handle($retro))->keyBy('key');
        $viewer = $this->context->participant($retro);
        $myScores = $viewer === null
            ? collect()
            : $retro->healthCheckAnswers()->where('participant_id', $viewer->id)->pluck('score', 'statement');

        return [
            'status' => 'in_progress',
            'categories' => $retro->healthStatements()->get()->map(function (RetroHealthStatement $statement) use ($progress, $names): array {
                $presented = $this->presentHealthStatement->handle($statement);

                return [
                    'key' => $presented['key'],
                    'label' => $presented['label'],
                    'answers' => $progress[$statement->key]['count'] ?? 0,
                    'answeredBy' => collect($progress[$statement->key]['answeredBy'] ?? [])
                        ->map(fn (string $participantId) => $names->get($participantId, __('Former member')))
                        ->values()
                        ->all(),
                ];
            })->values()->all(),
            'myScores' => $myScores->map(fn (mixed $score): int => (int) $score)->all(),
        ];
    }
}
