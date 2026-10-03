<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\ChangeTeamSurveyStatus;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyStatusRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class TeamSurveyStatusesController extends Controller
{
    public function update(TeamSurveyStatusRequest $request, TeamSurvey $teamSurvey, ChangeTeamSurveyStatus $changeTeamSurveyStatus): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $target = $request->enum('status', TeamSurveyStatus::class);

        DB::transaction(function () use ($teamSurvey, $respondent, $target, $changeTeamSurveyStatus): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $changeTeamSurveyStatus->handle($locked, $target);
        });

        return response()->noContent();
    }
}
