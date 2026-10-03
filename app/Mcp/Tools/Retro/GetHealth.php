<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\PresentHealthCheck;
use App\Actions\HealthCheck\PresentHealthProgress;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Enums\McpScope;
use App\Enums\TeamSurveyStatus;
use App\Mcp\McpContext;
use App\Mcp\Tools\SkrumTool;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Support\Surveys\HealthScale;
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

    protected string $description = 'Get the team health check of a board: while the health check is open, who has answered and your own scores; once it is closed, the average per category (1–5), the overall score, alignment, strongest and weakest categories and the trend over the team\'s last health checks. Individual scores of others are never returned.';

    public function __construct(
        private McpContext $context,
        private HealthCheckSurvey $healthCheckSurvey,
        private PresentHealthProgress $presentHealthProgress,
        private PresentHealthCheck $presentHealthCheck,
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
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return Response::structured(['status' => 'not_run']);
        }

        if ($survey->status === TeamSurveyStatus::Open) {
            return Response::structured($this->inProgress($retro, $survey));
        }

        $summary = $this->summarizeHealthCheck->handle($retro);

        if ($summary === null) {
            return Response::structured(['status' => 'not_run']);
        }

        return Response::structured([
            'status' => 'completed',
            'scale' => HealthScale::Max,
            'categories' => collect($summary['statements'])->map(fn (array $statement): array => [
                'key' => $statement['key'],
                'label' => $statement['label'],
                'average' => $statement['average'],
                'answers' => $statement['count'],
                'alignment' => $statement['consensus'],
                'distribution' => $statement['distribution'],
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
                'surveyId' => $point['surveyId'],
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
    private function inProgress(Retro $retro, TeamSurvey $survey): array
    {
        $names = $retro->participants()->with('user')->get()->mapWithKeys(fn (Participant $participant): array => [$participant->id => $participant->displayName()]);
        $progress = $this->presentHealthProgress->forSurvey($survey, $retro);
        $answersByKey = collect($progress['statements'])->keyBy('key');
        $questions = $survey->questions()->get();
        $viewer = $this->context->participant($retro);
        $respondent = $viewer === null ? null : $this->presentHealthCheck->respondentOf($survey, $viewer);
        $myValues = $respondent === null ? collect() : TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $respondent->id)
            ->whereNotNull('value')
            ->pluck('value', 'team_survey_question_id');

        return [
            'status' => 'in_progress',
            'scale' => (int) ($questions->first()->scale_max ?? HealthScale::Max),
            'respondents' => $progress['respondents'],
            'categories' => $questions->map(fn (TeamSurveyQuestion $question): array => [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'answers' => $answersByKey[$question->match_key]['count'] ?? 0,
                'answeredBy' => collect($answersByKey[$question->match_key]['answeredBy'] ?? [])
                    ->map(fn (string $participantId) => $names->get($participantId, __('Former member')))
                    ->values()
                    ->all(),
            ])->values()->all(),
            'myScores' => $questions
                ->filter(fn (TeamSurveyQuestion $question): bool => $myValues->has($question->id))
                ->mapWithKeys(fn (TeamSurveyQuestion $question): array => [(string) $question->match_key => (int) $myValues[$question->id]])
                ->all(),
        ];
    }
}
