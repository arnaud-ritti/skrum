<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Events\Retros\SurveyDiscussionChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use App\Rules\SingleEmoji;
use App\Support\Database\Transactions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SurveyReactionsController extends Controller
{
    public function __construct(private PresentSurvey $presentSurvey) {}

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->toggle($request, $retro, $survey, adds: true);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        return $this->toggle($request, $retro, $survey, adds: false);
    }

    private function toggle(Request $request, Retro $retro, Survey $survey, bool $adds): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey, $participant);

        $validated = $request->validate([
            'emoji' => ['required', 'string', new SingleEmoji],
        ]);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant, $validated, $adds): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
            $fresh = $locked->surveys()->whereKey($survey->id)->firstOrFail();

            $this->guard($locked, $fresh, $participant);

            if ($adds) {
                $fresh->reactions()->firstOrCreate(
                    ['participant_id' => $participant->id, 'emoji' => $validated['emoji']],
                    ['retro_id' => $locked->id],
                );
            }

            if (! $adds) {
                $fresh->reactions()->where('participant_id', $participant->id)->where('emoji', $validated['emoji'])->delete();
            }

            new SurveyDiscussionChanged($locked->id, $fresh->id, $fresh->commentCount())->sendToOthers();

            return [$fresh, $locked];
        }, Transactions::Attempts);

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    private function guard(Retro $retro, Survey $survey, Participant $participant): void
    {
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
        RetroGuard::reactionsEnabled($retro);
        SurveyGuard::resultsVisible($survey, $participant);
    }
}
