<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Events\Retros\SurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SurveyClosuresController extends Controller
{
    public function __construct(private PresentSurvey $presentSurvey) {}

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->setClosed($request, $retro, $survey, true);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->setClosed($request, $retro, $survey, false);
    }

    private function setClosed(Request $request, Retro $retro, Survey $survey, bool $isClosed): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $isClosed): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            if ($fresh->is_closed !== $isClosed) {
                $fresh->is_closed = $isClosed;
                $fresh->version++;
                $fresh->save();

                SurveyChanged::for($fresh)->sendToOthers();
            }

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }
}
