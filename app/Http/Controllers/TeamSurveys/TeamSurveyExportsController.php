<?php

namespace App\Http\Controllers\TeamSurveys;

use App\Actions\TeamSurveys\ExportSurveyCsv;
use App\Actions\TeamSurveys\TeamSurveyGuard;
use App\Enums\TeamSurveyStatus;
use App\Http\Controllers\Controller;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Support\CsvDownload;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeamSurveyExportsController extends Controller
{
    public function show(Request $request, TeamSurvey $teamSurvey, ExportSurveyCsv $exportSurveyCsv): StreamedResponse
    {
        $respondent = TeamSurveyRespondent::current($request);

        TeamSurveyGuard::notGuest($respondent);
        TeamSurveyGuard::editor($teamSurvey, $respondent);

        if ($teamSurvey->status !== TeamSurveyStatus::Closed) {
            throw ValidationException::withMessages(['survey' => __('Results can be exported once the survey is closed.')]);
        }

        if ($teamSurvey->responseCount() < $teamSurvey->results_threshold) {
            throw ValidationException::withMessages(['survey' => __('Not enough answers to show results.')]);
        }

        return CsvDownload::stream($exportSurveyCsv->rows($teamSurvey), $exportSurveyCsv->fileName($teamSurvey));
    }
}
