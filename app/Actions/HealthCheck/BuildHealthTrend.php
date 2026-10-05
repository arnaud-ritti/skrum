<?php

namespace App\Actions\HealthCheck;

use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Support\Surveys\HealthScale;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class BuildHealthTrend
{
    private const int Points = 6;

    /**
     * Guests of one retro must not see the team's other sessions.
     *
     * @return array<int, array{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>|null
     */
    public function forViewer(Retro $retro, Participant $viewer): ?array
    {
        if ($viewer->isGuest()) {
            return null;
        }

        return $this->handle($retro);
    }

    /**
     * @return array<int, array{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>
     */
    public function handle(Retro $retro): array
    {
        return $this->forTeam($retro->team_id, $retro->completed_at);
    }

    /**
     * @return array<int, array{retroId: ?string, surveyId: string, title: string, completedAt: string, score: float, url: string, delta: ?float, sameStatements: bool}>
     */
    public function forTeam(string $teamId, ?CarbonInterface $until = null): array
    {
        $surveys = $this->closedHealthChecks($teamId)
            ->when($until, fn ($query, $until) => $query->where('closed_at', '<=', $until))
            ->limit(self::Points)
            ->get()
            ->reverse()
            ->values();

        $keys = $this->keysOf($surveys);
        $scores = $this->scoresOf($surveys);
        $points = [];
        $previous = null;

        foreach ($surveys as $survey) {
            $score = $scores->get($survey->id);

            if ($score === null) {
                continue;
            }

            $ownKeys = $keys->get($survey->id, []);

            $points[] = [
                'retroId' => $survey->retro_id,
                'surveyId' => $survey->id,
                'title' => $survey->retro_id === null ? $survey->title : $survey->retro->title,
                'completedAt' => $survey->closed_at->toIso8601String(),
                'score' => $score,
                'url' => $survey->retro_id === null ? route('surveys.results.show', $survey) : route('retros.show', $survey->retro_id),
                'delta' => $previous === null ? null : round($score - $previous['score'], 1),
                'sameStatements' => $previous === null || $previous['keys'] === $ownKeys,
            ];

            $previous = ['score' => $score, 'keys' => $ownKeys];
        }

        return $points;
    }

    /**
     * A health check attached to a retro counts once that retro is completed,
     * as a running retro never was in a trend.
     *
     * @return Builder<TeamSurvey>
     */
    public function closedHealthChecks(string $teamId): Builder
    {
        return TeamSurvey::query()
            ->where('team_id', $teamId)
            ->where('template', TeamSurveyTemplate::HealthCheck)
            ->where('status', TeamSurveyStatus::Closed)
            ->whereNotNull('closed_at')
            ->whereHas('questions.answers')
            ->where(fn (Builder $query) => $query
                ->whereNull('retro_id')
                ->orWhereHas('retro', fn (Builder $retro) => $retro->where('phase', RetroPhase::Completed)))
            ->with('retro:id,title,phase,completed_at')
            ->orderByDesc('closed_at')
            ->orderByDesc('id');
    }

    /**
     * The score of each survey on the health scale: each question's mean on
     * its own scale, normalised and rounded, then `SummarizeHealthCheck::scoreOf`.
     *
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, ?float> score by survey id, null when it has no answer
     */
    public function scoresOf(Collection $surveys): Collection
    {
        $questions = TeamSurveyQuestion::query()->whereIn('team_survey_id', $surveys->pluck('id'))->get(['id', 'team_survey_id', 'scale_max']);

        $valuesByQuestion = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->whereNotNull('value')
            ->get(['team_survey_question_id', 'value'])
            ->groupBy('team_survey_question_id');

        $questionsBySurvey = $questions->groupBy('team_survey_id');

        return $surveys->mapWithKeys(function (TeamSurvey $survey) use ($questionsBySurvey, $valuesByQuestion): array {
            $averages = $questionsBySurvey->get($survey->id, collect())
                ->filter(fn (TeamSurveyQuestion $question): bool => $valuesByQuestion->has($question->id))
                ->map(fn (TeamSurveyQuestion $question): float => HealthScale::averageOf($valuesByQuestion->get($question->id), (int) $question->scale_max))
                ->values()
                ->all();

            return [$survey->id => SummarizeHealthCheck::scoreOf($averages)];
        });
    }

    /**
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, array<int, string>> sorted statement keys by survey id
     */
    private function keysOf(Collection $surveys): Collection
    {
        return TeamSurveyQuestion::query()
            ->whereIn('team_survey_id', $surveys->pluck('id'))
            ->get(['team_survey_id', 'match_key'])
            ->groupBy('team_survey_id')
            ->mapWithKeys(fn (Collection $questions, int|string $surveyId): array => [(string) $surveyId => $questions->pluck('match_key')->map(fn (mixed $key): string => (string) $key)->sort()->values()->all()]);
    }
}
