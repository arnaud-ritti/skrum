<?php

namespace App\Actions\HealthCheck;

use App\Enums\TeamSurveyStatus;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Support\Surveys\HealthScale;
use Illuminate\Database\Eloquent\Builder;

class PresentHealthCheck
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private PresentHealthProgress $presentHealthProgress,
        private SummarizeHealthCheck $summarizeHealthCheck,
    ) {}

    /**
     * @return array{
     *     surveyId: string,
     *     isClosed: bool,
     *     scale: int,
     *     respondents: int,
     *     participants: int,
     *     hasSubmitted: bool,
     *     submittedBy: array<int, string>,
     *     statements: array<int, array{key: string, label: string, text: string, isBuiltin: bool, myScore: ?int}>,
     *     results: ?array<string, mixed>
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer): ?array
    {
        $survey = $this->healthCheckSurvey->forRetro($retro);

        if ($survey === null) {
            return null;
        }

        $progress = $this->presentHealthProgress->forSurvey($survey, $retro);
        $isClosed = $survey->status === TeamSurveyStatus::Closed;
        $questions = $survey->questions()->get();
        $respondent = $this->respondentOf($survey, $viewer);
        $myScores = $respondent === null ? [] : TeamSurveyAnswer::query()
            ->where('team_survey_respondent_id', $respondent->id)
            ->whereNotNull('value')
            ->pluck('value', 'team_survey_question_id')
            ->map(fn (mixed $value): int => (int) $value)
            ->all();

        return [
            'surveyId' => $survey->id,
            'isClosed' => $isClosed,
            'scale' => HealthScale::Max,
            'respondents' => $progress['respondents'],
            'participants' => $progress['participants'],
            'hasSubmitted' => (bool) $respondent?->hasSubmitted(),
            'submittedBy' => $isClosed || $retro->is_anonymous || ! $retro->isFacilitator($viewer) ? [] : $this->submittedBy($survey),
            'statements' => $questions->map(fn (TeamSurveyQuestion $question): array => [
                'key' => (string) $question->match_key,
                'label' => (string) $question->displayShortLabel(),
                'text' => $question->displayLabel(),
                'isBuiltin' => $question->builtin !== null,
                'myScore' => $myScores[$question->id] ?? null,
            ])->values()->all(),
            'results' => $isClosed ? $this->summarizeHealthCheck->handle($retro, $viewer) : null,
        ];
    }

    /**
     * The retro participants who have sent their answers, in the order they
     * sent them: for the facilitator of a named retro, while it is open.
     *
     * @return array<int, string>
     */
    private function submittedBy(TeamSurvey $survey): array
    {
        return TeamSurveyRespondent::query()
            ->where('team_survey_id', $survey->id)
            ->whereNotNull('completed_at')
            ->whereNotNull('participant_id')
            ->oldest('completed_at')
            ->orderBy('id')
            ->pluck('participant_id')
            ->all();
    }

    /**
     * Reads the viewer's respondent without creating one: a snapshot must
     * not add rows.
     */
    public function respondentOf(TeamSurvey $survey, Participant $viewer): ?TeamSurveyRespondent
    {
        return TeamSurveyRespondent::query()
            ->where('team_survey_id', $survey->id)
            ->where(fn (Builder $query) => $query
                ->where('participant_id', $viewer->id)
                ->when($viewer->user_id !== null, fn (Builder $own) => $own->orWhere('user_id', $viewer->user_id)))
            ->orderBy('id')
            ->first();
    }
}
