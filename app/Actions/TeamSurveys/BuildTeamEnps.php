<?php

namespace App\Actions\TeamSurveys;

use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class BuildTeamEnps
{
    public const string TeamQuestion = 'enps_team';

    public const int HistoryLimit = 24;

    public function __construct(private SummarizeSurveyQuestion $summarizeSurveyQuestion) {}

    /**
     * The team's eNPS over its closed standalone eNPS surveys, newest first. A survey counts
     * while it holds an answered NPS question keyed `TeamQuestion`, and once it has the number
     * of answers under which its own results page shows no figure.
     *
     * @return array{
     *     latest: array{id: string, title: string, url: string, closedOn: string, answers: int, score: int, change: ?int, promoters: int, passives: int, detractors: int}|null,
     *     history: list<array{id: string, title: string, url: string, closedOn: string, answers: int, score: int, change: ?int, promoters: int, passives: int, detractors: int}>
     * }
     */
    public function handle(Team $team): array
    {
        $surveys = $this->countedSurveys($team);
        $summaries = $this->summaries($surveys);
        $points = [];

        foreach ($surveys as $index => $survey) {
            $summary = $summaries[$survey->id];
            $older = $surveys->get($index + 1);

            $points[] = [
                'id' => $survey->id,
                'title' => $survey->title,
                'url' => route('surveys.results.show', $survey),
                'closedOn' => (string) $survey->closed_at?->toDateString(),
                'answers' => $summary['responses'],
                'score' => $summary['nps'],
                'change' => $older === null ? null : $summary['nps'] - $summaries[$older->id]['nps'],
                'promoters' => $summary['promoters'],
                'passives' => $summary['passives'],
                'detractors' => $summary['detractors'],
            ];
        }

        $history = array_slice($points, 0, self::HistoryLimit);

        return ['latest' => $history[0] ?? null, 'history' => $history];
    }

    /**
     * One more than the history shows, so that its oldest line still has a survey to be compared with.
     *
     * @return Collection<int, TeamSurvey>
     */
    private function countedSurveys(Team $team): Collection
    {
        return $team->teamSurveys()
            ->where('template', TeamSurveyTemplate::Enps)
            ->whereNull('retro_id')
            ->where('status', TeamSurveyStatus::Closed)
            ->whereNotNull('closed_at')
            ->whereHas('questions', $this->answeredTeamQuestion(...))
            ->withCount(['respondents as response_count' => fn (Builder $respondents) => $respondents->whereHas('answers')])
            ->orderByDesc('closed_at')
            ->orderByDesc('id')
            ->lazy(self::HistoryLimit + 1)
            ->filter(fn (TeamSurvey $survey): bool => $survey->response_count >= $survey->results_threshold)
            ->take(self::HistoryLimit + 1)
            ->collect()
            ->values();
    }

    /**
     * The figures `SummarizeSurveyQuestion` gives the results page for the team question of each survey.
     *
     * @param  Collection<int, TeamSurvey>  $surveys
     * @return array<string, array{responses: int, nps: int, promoters: int, passives: int, detractors: int}>
     */
    private function summaries(Collection $surveys): array
    {
        $questions = $this->answeredTeamQuestion(TeamSurveyQuestion::query()->whereIn('team_survey_id', $surveys->pluck('id')))
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->unique('team_survey_id');

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->whereNotNull('value')
            ->get()
            ->groupBy('team_survey_question_id');

        return $questions
            ->mapWithKeys(function (TeamSurveyQuestion $question) use ($answers): array {
                $summary = $this->summarizeSurveyQuestion->handle($question, $answers->get($question->id, collect()));

                return [$question->team_survey_id => [
                    'responses' => (int) $summary['responses'],
                    'nps' => (int) $summary['nps'],
                    'promoters' => (int) $summary['promoters'],
                    'passives' => (int) $summary['passives'],
                    'detractors' => (int) $summary['detractors'],
                ]];
            })
            ->all();
    }

    /**
     * @param  Builder<TeamSurveyQuestion>  $questions
     * @return Builder<TeamSurveyQuestion>
     */
    private function answeredTeamQuestion(Builder $questions): Builder
    {
        return $questions
            ->where('kind', TeamSurveyQuestionKind::Nps)
            ->where('match_key', self::TeamQuestion)
            ->whereHas('answers', fn (Builder $answers) => $answers->whereNotNull('value'));
    }
}
