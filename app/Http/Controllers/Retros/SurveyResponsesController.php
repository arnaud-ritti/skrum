<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\PresentSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Enums\SurveyKind;
use App\Events\Retros\SurveyChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class SurveyResponsesController extends Controller
{
    public function __construct(private PresentSurvey $presentSurvey) {}

    public function update(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($request, $retro, $survey, $participant): array {
            [$locked, $fresh] = $this->lock($retro, $survey);

            $validated = Validator::make($request->all(), $this->rules($fresh))->validate();

            $this->clear($fresh, $participant);
            $this->store($fresh, $participant, $validated);

            SurveyChanged::for($fresh)->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    public function destroy(Request $request, Retro $retro, Survey $survey): JsonResponse
    {
        $participant = Participant::current($request);

        $this->guard($retro, $survey);

        [$fresh, $presentingRetro] = DB::transaction(function () use ($retro, $survey, $participant): array {
            [$locked, $fresh] = $this->lock($retro, $survey);

            $this->clear($fresh, $participant);

            SurveyChanged::for($fresh)->sendToOthers();

            return [$fresh, $locked];
        });

        return response()->json(['survey' => $this->presentSurvey->handle($fresh, $presentingRetro, $participant)]);
    }

    private function guard(Retro $retro, Survey $survey): void
    {
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);
        SurveyGuard::open($survey);
    }

    /**
     * The answer is validated against the locked survey so a concurrent
     * edit of its kind or options cannot slip a mismatched answer in.
     *
     * @return array{0: Retro, 1: Survey}
     */
    private function lock(Retro $retro, Survey $survey): array
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();
        $fresh = $locked->surveys()->whereKey($survey->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked, $fresh);

        return [$locked, $fresh];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(Survey $survey): array
    {
        $optionOfThisSurvey = Rule::exists('survey_options', 'id')->where('survey_id', $survey->id);

        return match ($survey->kind) {
            SurveyKind::Single => [
                'optionId' => ['required', 'uuid', $optionOfThisSurvey],
                'optionIds' => ['prohibited'],
                'text' => ['prohibited'],
            ],
            SurveyKind::Multiple => [
                'optionIds' => ['required', 'array', 'min:1'],
                'optionIds.*' => ['uuid', 'distinct', $optionOfThisSurvey],
                'optionId' => ['prohibited'],
                'text' => ['prohibited'],
            ],
            SurveyKind::Text => [
                'text' => ['required', 'string', 'max:500'],
                'optionId' => ['prohibited'],
                'optionIds' => ['prohibited'],
            ],
        };
    }

    private function clear(Survey $survey, Participant $participant): void
    {
        $survey->responses()->where('participant_id', $participant->id)->delete();
        $survey->textAnswers()->where('participant_id', $participant->id)->delete();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function store(Survey $survey, Participant $participant, array $validated): void
    {
        if ($survey->kind === SurveyKind::Text) {
            $survey->textAnswers()->create(['participant_id' => $participant->id, 'content' => $validated['text']]);

            return;
        }

        $optionIds = $survey->kind === SurveyKind::Single ? [$validated['optionId']] : $validated['optionIds'];

        foreach ($optionIds as $optionId) {
            $survey->responses()->create(['survey_option_id' => $optionId, 'participant_id' => $participant->id]);
        }
    }
}
