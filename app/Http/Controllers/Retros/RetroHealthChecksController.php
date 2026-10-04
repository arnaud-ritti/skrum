<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\AttachHealthCheck;
use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\RetroGuard;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\RetroSettingsChanged;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Events\TeamSurveys\TeamSurveyDeleted;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class RetroHealthChecksController extends Controller
{
    public function store(Request $request, Retro $retro, AttachHealthCheck $attachHealthCheck): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $surveyId = DB::transaction(function () use ($retro, $participant, $attachHealthCheck): string {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $survey = $attachHealthCheck->handle($locked);

            new RetroSettingsChanged($locked->id)->sendToOthers();

            return $survey->id;
        });

        return response()->json(['surveyId' => $surveyId], 201);
    }

    /**
     * Without answers the health check goes; with answers it is hidden and
     * kept, as turning the setting off always did.
     */
    public function destroy(Request $request, Retro $retro, HealthCheckSurvey $healthCheckSurvey): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        DB::transaction(function () use ($retro, $participant, $healthCheckSurvey): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $found = $healthCheckSurvey->forRetro($locked);

            abort_if($found === null, 404);

            $survey = TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail();

            if ($survey->hasAnswers()) {
                $survey->update(['status' => TeamSurveyStatus::Draft, 'closed_at' => null, 'version' => $survey->version + 1]);

                TeamSurveyChanged::for($survey)->sendToOthers();
            }

            if (! $survey->hasAnswers()) {
                $surveyId = $survey->id;

                $survey->delete();

                new TeamSurveyDeleted($surveyId)->sendToOthers();
            }

            new RetroSettingsChanged($locked->id)->sendToOthers();
        });

        return response()->noContent();
    }
}
