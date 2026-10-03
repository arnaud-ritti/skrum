<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\RetroGuard;
use App\Actions\TeamSurveys\ChangeTeamSurveyStatus;
use App\Enums\TeamSurveyStatus;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TeamSurvey;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class RetroHealthCheckClosuresController extends Controller
{
    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private ChangeTeamSurveyStatus $changeTeamSurveyStatus,
    ) {}

    public function update(Request $request, Retro $retro): Response
    {
        return $this->change($request, $retro, TeamSurveyStatus::Closed);
    }

    public function destroy(Request $request, Retro $retro): Response
    {
        return $this->change($request, $retro, TeamSurveyStatus::Open);
    }

    private function change(Request $request, Retro $retro, TeamSurveyStatus $target): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        DB::transaction(function () use ($retro, $participant, $target): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $found = $this->healthCheckSurvey->forRetro($locked);

            abort_if($found === null, 404);

            $this->changeTeamSurveyStatus->handle(
                TeamSurvey::query()->whereKey($found->id)->lockForUpdate()->firstOrFail(),
                $target,
            );

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
