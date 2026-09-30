<?php

namespace App\Http\Controllers\Retros;

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\RetroSettingsChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroSettingsController extends Controller
{
    private const OpenPhaseSettings = [
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
        'health_check_enabled', 'icebreaker_enabled',
    ];

    public function __construct(private FreezeHealthStatements $freezeHealthStatements) {}

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
            'health_check_enabled' => ['sometimes', 'boolean'],
            'icebreaker_enabled' => ['sometimes', 'boolean'],
        ]);

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

            $isEnablingHealthCheck = ($validated['health_check_enabled'] ?? false)
                && ! $locked->health_check_enabled;

            $locked->update($validated);

            if ($isEnablingHealthCheck) {
                $this->freezeHealthStatements->handle($locked);
            }

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function ensureCurrentPhaseStaysOn(Retro $retro, array $validated): void
    {
        $toggles = [
            'health_check_enabled' => RetroPhase::HealthCheck,
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
