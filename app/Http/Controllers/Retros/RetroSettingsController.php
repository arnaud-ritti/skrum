<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Games\IcebreakerGameOptions;
use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Retros\RetroGuard;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SurveyReaction;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;
use App\Support\Llm\Llm;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RetroSettingsController extends Controller
{
    private const array OpenPhaseSettings = [
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
        'icebreaker_enabled', 'ai_summary_enabled', 'icebreaker_game',
    ];

    public function __construct(
        private HealthCheckSurvey $healthCheckSurvey,
        private Llm $llm,
        private IcebreakerGameOptions $icebreakerGameOptions,
    ) {}

    public function update(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'is_anonymous' => ['sometimes', 'boolean'],
            'votes_per_participant' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'gifs_enabled' => ['sometimes', 'boolean'],
            'hide_vote_counts' => ['sometimes', 'boolean'],
            'is_locked' => ['sometimes', 'boolean'],
            'presentation_mode' => ['sometimes', 'boolean'],
            'icebreaker_enabled' => ['sometimes', 'boolean'],
            'icebreaker_game' => ['sometimes', Rule::enum(GameKind::class), $this->icebreakerGameOptions->rule()],
            'ai_summary_enabled' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('ai_summary_enabled', $validated) && ! $this->llm->isConfigured()) {
            throw ValidationException::withMessages(['ai_summary_enabled' => __('Not available.')]);
        }

        DB::transaction(function () use ($retro, $participant, $validated): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            if (array_intersect(array_keys($validated), self::OpenPhaseSettings) !== []) {
                RetroGuard::open($locked);
            }

            if (array_key_exists('votes_per_participant', $validated)) {
                RetroGuard::phase($locked, RetroPhase::HealthCheck, RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping);
            }

            $this->ensureCurrentPhaseStaysOn($locked, $validated);

            $isDisablingAnonymity = array_key_exists('is_anonymous', $validated)
                && ! $validated['is_anonymous']
                && $locked->is_anonymous;

            if ($isDisablingAnonymity && $locked->cards()->exists()) {
                throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before any card is written.')]);
            }

            if ($isDisablingAnonymity && (bool) $this->healthCheckSurvey->forRetro($locked)?->hasAnswers()) {
                throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before anyone answers.')]);
            }

            if ($isDisablingAnonymity && $this->hasSurveyActivity($locked)) {
                throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before anyone answers.')]);
            }

            $locked->update($validated);

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    private function hasSurveyActivity(Retro $retro): bool
    {
        return $retro->surveyComments()->exists()
            || SurveyReaction::query()->where('retro_id', $retro->id)->exists()
            || SurveyResponse::query()->whereIn('survey_id', $retro->surveys()->select('id'))->exists()
            || SurveyTextAnswer::query()->whereIn('survey_id', $retro->surveys()->select('id'))->exists();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function ensureCurrentPhaseStaysOn(Retro $retro, array $validated): void
    {
        $toggles = [
            'icebreaker_enabled' => RetroPhase::Icebreaker,
        ];

        foreach ($toggles as $setting => $phase) {
            if (! array_key_exists($setting, $validated) || (bool) $validated[$setting]) {
                continue;
            }

            if ($retro->phase !== $phase) {
                continue;
            }

            throw ValidationException::withMessages([$setting => __('Move to another phase before turning this phase off.')]);
        }
    }
}
