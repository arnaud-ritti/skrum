<?php

namespace App\Http\Controllers\Retros;

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
    private const EngagementSettings = [
        'reactions_enabled', 'cursors_enabled', 'gifs_enabled', 'hide_vote_counts', 'is_locked', 'presentation_mode',
    ];

    public function update(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'is_anonymous' => ['sometimes', 'boolean'],
            'votes_per_participant' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'gifs_enabled' => ['sometimes', 'boolean'],
            'hide_vote_counts' => ['sometimes', 'boolean'],
            'is_locked' => ['sometimes', 'boolean'],
            'presentation_mode' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($retro, $participant, $validated): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            if (array_intersect(array_keys($validated), self::EngagementSettings) !== []) {
                RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing);
            }

            if (array_key_exists('votes_per_participant', $validated)) {
                RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            }

            $isDisablingAnonymity = array_key_exists('is_anonymous', $validated)
                && ! $validated['is_anonymous']
                && $locked->is_anonymous;

            if ($isDisablingAnonymity && $locked->cards()->exists()) {
                throw ValidationException::withMessages(['is_anonymous' => __('Anonymity can only be turned off before any card is written.')]);
            }

            $locked->update($validated);

            (new RetroSettingsChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }
}
