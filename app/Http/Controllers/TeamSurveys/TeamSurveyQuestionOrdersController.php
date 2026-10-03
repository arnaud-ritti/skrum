<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyQuestionOrderRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeamSurveyQuestionOrdersController extends Controller
{
    public function update(TeamSurveyQuestionOrderRequest $request, TeamSurvey $teamSurvey): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $ids = $request->questionIds();

        DB::transaction(function () use ($teamSurvey, $respondent, $ids): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);
            TeamSurveyGuard::structureEditable($locked);

            $questions = $locked->questions()->get()->keyBy('id');
            $sent = $ids;
            $known = $questions->keys()->all();

            sort($sent);
            sort($known);

            if ($sent !== $known) {
                throw ValidationException::withMessages(['ids' => __('Send every question exactly once.')]);
            }

            foreach ($ids as $position => $id) {
                $questions[$id]->update(['position' => $position]);
            }

            $locked->increment('version');

            TeamSurveyChanged::for($locked)->sendToOthers();
        });

        return response()->noContent();
    }
}
