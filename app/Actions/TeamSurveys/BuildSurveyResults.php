<?php

namespace App\Actions\TeamSurveys;

use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;

class BuildSurveyResults
{
    public function __construct(private SummarizeSurveyQuestion $summarizeSurveyQuestion) {}

    /**
     * Null when the viewer may not see results; aggregates are withheld
     * from everyone, editors included, below the survey's threshold.
     *
     * @return array{belowThreshold: bool, responses: int, questions: array<string, array<string, mixed>>}|null
     */
    public function handle(TeamSurvey $survey, TeamSurveyRespondent $viewer): ?array
    {
        if (! $survey->resultsVisibleTo($viewer)) {
            return null;
        }

        $responses = $survey->responseCount();

        if ($responses < $survey->results_threshold) {
            return ['belowThreshold' => true, 'responses' => $responses, 'questions' => []];
        }

        return [
            'belowThreshold' => false,
            'responses' => $responses,
            'questions' => $this->summaries($survey, $viewer),
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function summaries(TeamSurvey $survey, ?TeamSurveyRespondent $viewer = null): array
    {
        $questions = $survey->questions()->with('options')->get();

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('options')
            ->get()
            ->groupBy('team_survey_question_id');

        return $questions
            ->mapWithKeys(fn (TeamSurveyQuestion $question): array => [
                $question->id => $this->summarizeSurveyQuestion->handle($question, $answers->get($question->id, collect()), $viewer),
            ])
            ->all();
    }
}
