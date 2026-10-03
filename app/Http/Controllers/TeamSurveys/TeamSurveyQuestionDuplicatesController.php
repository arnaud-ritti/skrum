<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\PresentSurveyQuestion;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyOption;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeamSurveyQuestionDuplicatesController extends Controller
{
    public function store(Request $request, TeamSurvey $teamSurvey, TeamSurveyQuestion $question, PresentSurveyQuestion $presentSurveyQuestion): JsonResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $copy = DB::transaction(function () use ($teamSurvey, $question, $respondent): TeamSurveyQuestion {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);
            TeamSurveyGuard::structureEditable($locked);

            if ($locked->questions()->count() >= TeamSurvey::MaxQuestions) {
                throw ValidationException::withMessages(['survey' => __('A survey can have at most 30 questions.')]);
            }

            $source = $locked->questions()->with('options')->whereKey($question->id)->firstOrFail();

            foreach ($locked->questions()->where('position', '>', $source->position)->get() as $later) {
                $later->update(['position' => $later->position + 1]);
            }

            $copy = $source->replicate(['match_key']);
            $copy->match_key = Str::random(16);
            $copy->position = $source->position + 1;
            $copy->save();

            $source->options->each(fn (TeamSurveyOption $option) => $copy->options()->create([
                'label' => $option->label,
                'position' => $option->position,
            ]));

            $locked->increment('version');

            TeamSurveyChanged::for($locked)->sendToOthers();

            return $copy;
        });

        return response()->json(['question' => $presentSurveyQuestion->handle($copy->fresh() ?? $copy)], 201);
    }
}
