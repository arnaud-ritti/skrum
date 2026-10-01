<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\SummarizeRoti;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class GetRoti extends SkrumTool
{
    private const int TrendPoints = 6;

    protected string $name = 'retro.board.roti.get';

    protected string $description = 'Get the ROTI (return on time invested, 1 to 5) of a board: while collecting, how many rated and your own rating; once finished, the average, the distribution and the trend over the team\'s last finished boards. Other people\'s ratings are never returned.';

    public function __construct(
        private McpContext $context,
        private SummarizeRoti $summarizeRoti,
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

        if (! in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)) {
            return Response::structured(['status' => 'not_started']);
        }

        $viewer = $this->context->participant($retro);
        $myScore = $viewer === null ? null : $retro->rotiVotes()->where('participant_id', $viewer->id)->value('score');
        $myScore = $myScore === null ? null : (int) $myScore;

        if ($retro->phase === RetroPhase::Discussing) {
            return Response::structured([
                'status' => 'collecting',
                'respondents' => $retro->rotiVotes()->count(),
                'myScore' => $myScore,
            ]);
        }

        $roti = $this->summarizeRoti->handle($retro);

        return Response::structured([
            'status' => 'completed',
            'average' => $roti['average'],
            'distribution' => $roti['distribution'],
            'respondents' => $roti['respondents'],
            'myScore' => $myScore,
            'trend' => $this->trend($retro),
        ]);
    }

    /**
     * @return array<int, array{boardId: string, title: string, completedAt: ?string, average: ?float, respondents: int, url: string}>
     */
    private function trend(Retro $retro): array
    {
        return Retro::query()
            ->where('team_id', $retro->team_id)
            ->where('phase', RetroPhase::Completed)
            ->whereNotNull('completed_at')
            ->when($retro->completed_at, fn ($query, $completedAt) => $query->where('completed_at', '<=', $completedAt))
            ->whereHas('rotiVotes')
            ->withCount('rotiVotes')
            ->withAvg('rotiVotes', 'score')
            ->orderByDesc('completed_at')
            ->limit(self::TrendPoints)
            ->get()
            ->reverse()
            ->map(fn (Retro $point): array => [
                'boardId' => $point->id,
                'title' => $point->title,
                'completedAt' => $point->completed_at?->toIso8601String(),
                'average' => $point->roti_votes_avg_score === null ? null : round((float) $point->roti_votes_avg_score, 1),
                'respondents' => (int) $point->roti_votes_count,
                'url' => route('retros.show', $point),
            ])
            ->values()
            ->all();
    }
}
