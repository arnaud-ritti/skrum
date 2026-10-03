<?php

namespace App\Actions\Teams;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Support\Teams\SprintCalendar;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class BuildTeamMoodTrend
{
    private const int Points = 8;

    public function __construct(private BuildHealthTrend $buildHealthTrend) {}

    /**
     * ROTI comes from completed retros (1 to 5). Mood comes from closed
     * health checks, on the health scale: the one attached to a completed
     * retro joins that retro's point, one run as a survey is a point of its own.
     *
     * @return list<array{
     *     retroId: ?string,
     *     surveyId: ?string,
     *     title: string,
     *     completedAt: string,
     *     url: string,
     *     mood: ?float,
     *     moodVoters: int,
     *     roti: ?float,
     *     rotiVoters: int,
     *     sprintLabel: ?string
     * }>
     */
    public function handle(Team $team): array
    {
        $surveys = $this->buildHealthTrend->closedHealthChecks($team->id)->get();
        $scores = $this->buildHealthTrend->scoresOf($surveys);
        $voters = $this->votersOf($surveys);

        $attached = $surveys
            ->filter(fn (TeamSurvey $survey): bool => $survey->retro_id !== null && $scores->get($survey->id) !== null)
            ->keyBy('retro_id');

        $retros = Retro::query()
            ->where('team_id', $team->id)
            ->where('phase', RetroPhase::Completed)
            ->whereNotNull('completed_at')
            ->where(fn ($query) => $query->whereIn('id', $attached->keys())->orHas('rotiVotes'))
            ->withAvg('rotiVotes', 'score')
            ->withCount('rotiVotes')
            ->get(['id', 'title', 'completed_at', 'created_at']);

        $points = $retros->map(function (Retro $retro) use ($attached, $scores, $voters): array {
            $survey = $attached->get($retro->id);

            return ['at' => $retro->completed_at->getTimestamp(), 'id' => $retro->id, 'createdAt' => $retro->created_at, 'point' => [
                'retroId' => $retro->id,
                'surveyId' => $survey?->id,
                'title' => $retro->title,
                'completedAt' => $retro->completed_at->toIso8601String(),
                'url' => route('retros.show', $retro),
                'mood' => $survey === null ? null : $scores->get($survey->id),
                'moodVoters' => $survey === null ? 0 : (int) $voters->get($survey->id, 0),
                'roti' => $retro->roti_votes_avg_score === null ? null : round((float) $retro->roti_votes_avg_score, 1),
                'rotiVoters' => (int) $retro->roti_votes_count,
            ]];
        })->concat(
            $surveys
                ->filter(fn (TeamSurvey $survey): bool => $survey->retro_id === null && $scores->get($survey->id) !== null)
                ->map(fn (TeamSurvey $survey): array => ['at' => $survey->closed_at->getTimestamp(), 'id' => $survey->id, 'createdAt' => $survey->created_at, 'point' => [
                    'retroId' => null,
                    'surveyId' => $survey->id,
                    'title' => $survey->title,
                    'completedAt' => $survey->closed_at->toIso8601String(),
                    'url' => route('surveys.results.show', $survey),
                    'mood' => $scores->get($survey->id),
                    'moodVoters' => (int) $voters->get($survey->id, 0),
                    'roti' => null,
                    'rotiVoters' => 0,
                ]]),
        );

        $shown = $points
            ->sort(fn (array $first, array $second): int => [$second['at'], $second['id']] <=> [$first['at'], $first['id']])
            ->take(self::Points)
            ->reverse()
            ->values();

        if ($shown->isEmpty()) {
            return [];
        }

        $createdDays = $shown->map(fn (array $entry): CarbonInterface => $entry['createdAt']);
        $calendar = SprintCalendar::forTeam($team, $createdDays->min(), $createdDays->max());

        return array_values($shown
            ->map(fn (array $entry): array => [...$entry['point'], 'sprintLabel' => $calendar->shortLabelOn($entry['createdAt'])])
            ->all());
    }

    /**
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return Collection<string, int<0, max>> people who answered, by survey id
     */
    private function votersOf(Collection $surveys): Collection
    {
        $surveyOfQuestion = TeamSurveyQuestion::query()->whereIn('team_survey_id', $surveys->pluck('id'))->pluck('team_survey_id', 'id');

        return TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $surveyOfQuestion->keys())
            ->get(['team_survey_question_id', 'team_survey_respondent_id'])
            ->groupBy(fn (TeamSurveyAnswer $answer): string => (string) $surveyOfQuestion[$answer->team_survey_question_id])
            ->map(fn (Collection $own): int => $own->pluck('team_survey_respondent_id')->unique()->count())
            ->mapWithKeys(fn (int $count, int|string $surveyId): array => [(string) $surveyId => $count]);
    }
}
