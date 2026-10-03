<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyQuestionRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeamSurveyQuestionsController extends Controller
{
    public function __construct(private PresentSurveyQuestion $presentSurveyQuestion) {}

    public function store(TeamSurveyQuestionRequest $request, TeamSurvey $teamSurvey): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $question = DB::transaction(function () use ($request, $teamSurvey, $respondent): TeamSurveyQuestion {
            $locked = $this->lock($teamSurvey, $respondent);

            if ($locked->questions()->count() >= TeamSurvey::MaxQuestions) {
                throw ValidationException::withMessages(['survey' => __('A survey can have at most 30 questions.')]);
            }

            $lastPosition = $locked->questions()->max('position');

            $question = $locked->questions()->create([
                ...$request->attributesForQuestion(),
                'match_key' => Str::random(16),
                'position' => $lastPosition === null ? 0 : (int) $lastPosition + 1,
            ]);

            $this->replaceOptions($question, $request->optionLabels());
            $this->announce($locked);

            return $question;
        });

        return response()->json(['question' => $this->presentSurveyQuestion->handle($question->fresh() ?? $question)], 201);
    }

    public function update(TeamSurveyQuestionRequest $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $edited = DB::transaction(function () use ($request, $teamSurvey, $question, $respondent): TeamSurveyQuestion {
            $locked = $this->lock($teamSurvey, $respondent);
            $edited = $locked->questions()->whereKey($question->id)->firstOrFail();

            $edited->update($request->attributesForQuestion());

            $this->replaceOptions($edited, $request->optionLabels());
            $this->announce($locked);

            return $edited;
        });

        return response()->json(['question' => $this->presentSurveyQuestion->handle($edited->fresh() ?? $edited)]);
    }

    public function destroy(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        DB::transaction(function () use ($teamSurvey, $question, $respondent): void {
            $locked = $this->lock($teamSurvey, $respondent);

            $locked->questions()->whereKey($question->id)->firstOrFail()->delete();

            foreach ($locked->questions()->get()->values() as $position => $remaining) {
                $remaining->update(['position' => $position]);
            }

            $this->announce($locked);
        });

        return response()->noContent();
    }

    private function lock(TeamSurvey $survey, TeamSurveyRespondent $respondent): TeamSurvey
    {
        $locked = TeamSurvey::query()->whereKey($survey->id)->lockForUpdate()->firstOrFail();

        TeamSurveyGuard::editor($locked, $respondent);
        TeamSurveyGuard::structureEditable($locked);

        return $locked;
    }

    /**
     * @param  array<int, string>  $labels
     */
    private function replaceOptions(TeamSurveyQuestion $question, array $labels): void
    {
        $question->options()->delete();

        foreach ($labels as $position => $label) {
            $question->options()->create(['label' => $label, 'position' => $position]);
        }
    }

    private function announce(TeamSurvey $locked): void
    {
        $locked->increment('version');

        TeamSurveyChanged::for($locked)->sendToOthers();
    }
}
