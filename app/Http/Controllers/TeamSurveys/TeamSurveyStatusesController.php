<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\Teams\RecordTeamActivity;
use App\Actions\TeamSurveys\ChangeTeamSurveyStatus;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamActivityKind;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\TeamSurveys\TeamSurveyStatusRequest;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class TeamSurveyStatusesController extends Controller
{
    public function update(TeamSurveyStatusRequest $request, TeamSurvey $teamSurvey, ChangeTeamSurveyStatus $changeTeamSurveyStatus, RecordTeamActivity $recordTeamActivity): Response
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::editor($teamSurvey, $respondent);

        $target = $request->enum('status', TeamSurveyStatus::class);

        DB::transaction(function () use ($teamSurvey, $respondent, $target, $changeTeamSurveyStatus, $recordTeamActivity): void {
            $locked = TeamSurvey::query()->whereKey($teamSurvey->id)->lockForUpdate()->firstOrFail();

            TeamSurveyGuard::editor($locked, $respondent);

            $from = $locked->status;

            $changeTeamSurveyStatus->handle($locked, $target);

            $kind = $this->activityKind($locked, $from, $target);

            if ($kind === null) {
                return;
            }

            $recordTeamActivity->handle($locked->team_id, $kind, $respondent->user, $respondent->user === null ? $respondent->displayName() : null, $locked->id, $locked->title);
        });

        return response()->noContent();
    }

    /**
     * An attached health check belongs to its retro and writes no line of its own.
     */
    private function activityKind(TeamSurvey $survey, TeamSurveyStatus $from, TeamSurveyStatus $target): ?TeamActivityKind
    {
        if ($survey->retro_id !== null) {
            return null;
        }

        if ($target === TeamSurveyStatus::Closed) {
            return TeamActivityKind::SurveyClosed;
        }

        if ($from === TeamSurveyStatus::Draft && $target === TeamSurveyStatus::Open) {
            return TeamActivityKind::SurveyPublished;
        }

        return null;
    }
}
