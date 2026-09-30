<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Surveys\DraftSurvey;
use App\Actions\Surveys\SurveyGuard;
use App\Enums\SurveyKind;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Llm\Llm;
use App\Support\Llm\LlmRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SurveyDraftsController extends Controller
{
    private const DraftsPerMinute = 10;

    public function store(Request $request, Retro $retro, Llm $llm, DraftSurvey $draftSurvey): JsonResponse
    {
        $participant = Participant::current($request);

        abort_unless($llm->isConfigured(), 404);

        RetroGuard::facilitator($retro, $participant);
        SurveyGuard::activePhase($retro);
        RetroGuard::unlocked($retro);

        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:300'],
            'kind' => ['sometimes', Rule::enum(SurveyKind::class)],
        ]);

        LlmRateLimit::hit("survey-draft:{$participant->id}", self::DraftsPerMinute);

        $kind = SurveyKind::tryFrom($validated['kind'] ?? '') ?? SurveyKind::Single;

        return response()->json($draftSurvey->handle($retro, $validated['prompt'], $kind));
    }
}
