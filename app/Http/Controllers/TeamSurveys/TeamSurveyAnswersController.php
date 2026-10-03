<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\AnnounceSurveyResponses;
use App\Actions\TeamSurveys\PresentSurveyProgress;
use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Actions\TeamSurveys\SaveSurveyAnswer;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TeamSurveyAnswersController extends Controller
{
    public function __construct(
        private SaveSurveyAnswer $saveSurveyAnswer,
        private AnnounceSurveyResponses $announceSurveyResponses,
        private PresentSurveyQuestion $presentSurveyQuestion,
        private PresentSurveyProgress $presentSurveyProgress,
    ) {}

    public function update(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        $answer = DB::transaction(function () use ($request, $teamSurvey, $question, $respondent): TeamSurveyAnswer {
            [$locked, $fresh] = $this->lock($teamSurvey, $question);

            $validated = Validator::make($request->all(), $this->saveSurveyAnswer->rules($fresh))->validate();

            $answer = $this->saveSurveyAnswer->handle($fresh, $respondent, $validated);

            $this->announceSurveyResponses->handle($locked);

            return $answer;
        });

        return response()->json([
            'answer' => $this->presentSurveyQuestion->answer($answer),
            'progress' => $this->presentSurveyProgress->handle($teamSurvey),
        ]);
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::open($teamSurvey);

        DB::transaction(function () use ($teamSurvey, $question, $respondent): void {
            [$locked, $fresh] = $this->lock($teamSurvey, $question);

            $fresh->answers()->where('team_survey_respondent_id', $respondent->id)->delete();

            $this->announceSurveyResponses->handle($locked);
        });

        return response()->json(['answer' => null, 'progress' => $this->presentSurveyProgress->handle($teamSurvey)]);
    }

    /**
     * The answer is validated against the question read under the survey's
     * lock, so a concurrent edit cannot slip a mismatched answer in, and two
     * saves of the same answer run one after the other.
     *
     * @return array{0: TeamSurvey, 1: TeamSurveyQuestion}
     */
    private function lock(TeamSurvey $survey, TeamSurveyQuestion $question): array
    {
        $locked = TeamSurvey::query()->whereKey($survey->id)->lockForUpdate()->firstOrFail();

        TeamSurveyGuard::open($locked);

        return [$locked, $locked->questions()->whereKey($question->id)->firstOrFail()];
    }
}
