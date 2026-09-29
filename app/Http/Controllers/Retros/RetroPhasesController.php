<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\PhaseChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RetroPhasesController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);

        $validated = $request->validate([
            'phase' => ['required', Rule::enum(RetroPhase::class)],
        ]);

        $phase = RetroPhase::from($validated['phase']);

        DB::transaction(function () use ($retro, $participant, $phase): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);

            if (! $locked->phase->isAdjacentTo($phase)) {
                throw ValidationException::withMessages(['phase' => __('The retrospective can only move to the previous or next phase.')]);
            }

            $isCompleting = $phase === RetroPhase::Completed;

            $locked->update([
                'phase' => $phase,
                'completed_at' => $isCompleting ? now() : null,
                'timer_ends_at' => $isCompleting ? null : $locked->timer_ends_at,
            ]);

            (new PhaseChanged($locked->id, $phase->value))->sendToOthers();
        });

        return response()->json(['phase' => $phase->value]);
    }
}
