<?php

namespace App\Actions\HealthCheck;

use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use Illuminate\Support\Collection;

class PresentHealthProgress
{
    /**
     * `respondents` counts who have sent their answers; `participants` everyone
     * who joined the retro, guests included. Who answered a statement is named
     * by retro participant, on a retro that is not anonymous only, for the MCP
     * tool: the board shows counts alone.
     *
     * @return array{respondents: int, participants: int, statements: array<int, array{key: string, count: int, answeredBy: array<int, string>}>}
     */
    public function forSurvey(TeamSurvey $survey, Retro $retro): array
    {
        $questions = $survey->questions()->get(['id', 'match_key']);

        $answers = TeamSurveyAnswer::query()
            ->whereIn('team_survey_question_id', $questions->pluck('id'))
            ->with('respondent:id,participant_id')
            ->oldest()
            ->orderBy('id')
            ->get()
            ->groupBy('team_survey_question_id');

        return [
            'respondents' => $survey->completedCount(),
            'participants' => $retro->participants()->count(),
            'statements' => $questions->map(function (TeamSurveyQuestion $question) use ($retro, $answers): array {
                /** @var Collection<int, TeamSurveyAnswer> $own */
                $own = $answers->get($question->id, collect());

                return [
                    'key' => (string) $question->match_key,
                    'count' => $own->count(),
                    'answeredBy' => $retro->is_anonymous
                        ? []
                        : $own->map(fn (TeamSurveyAnswer $answer): ?string => $answer->respondent?->participant_id)->filter()->values()->all(),
                ];
            })->values()->all(),
        ];
    }
}
