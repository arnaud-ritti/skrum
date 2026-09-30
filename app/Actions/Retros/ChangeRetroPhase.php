<?php

namespace App\Actions\Retros;

use App\Actions\Surveys\CloseOpenSurveys;
use App\Enums\RetroPhase;
use App\Events\RetroCompleted;
use App\Events\Retros\PhaseChanged;
use App\Models\Retro;
use Illuminate\Validation\ValidationException;

class ChangeRetroPhase
{
    public function __construct(private CloseOpenSurveys $closeOpenSurveys) {}

    /**
     * Runs inside the caller's transaction, on a retro row locked for update.
     */
    public function handle(Retro $locked, RetroPhase $phase): void
    {
        $this->ensureReachable($locked, $phase);
        $this->move($locked, $phase);
        $this->closeSurveys($locked, $phase);
        $this->broadcast($locked, $phase);
        $this->announceCompletion($locked, $phase);
    }

    private function ensureReachable(Retro $locked, RetroPhase $phase): void
    {
        if ($locked->canMoveTo($phase)) {
            return;
        }

        throw ValidationException::withMessages(['phase' => __('The retrospective can only move to the previous or next phase.')]);
    }

    private function move(Retro $locked, RetroPhase $phase): void
    {
        $isCompleting = $phase === RetroPhase::Completed;
        $isLeavingDiscussing = $locked->phase === RetroPhase::Discussing;

        $locked->update([
            'phase' => $phase,
            'highlighted_card_id' => $isLeavingDiscussing ? null : $locked->highlighted_card_id,
            'completed_at' => $isCompleting ? now() : null,
            'timer_ends_at' => $isCompleting ? null : $locked->timer_ends_at,
        ]);
    }

    private function closeSurveys(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Completed) {
            return;
        }

        $this->closeOpenSurveys->handle($locked);
    }

    private function broadcast(Retro $locked, RetroPhase $phase): void
    {
        (new PhaseChanged($locked->id, $phase->value))->sendToOthers();
    }

    private function announceCompletion(Retro $retro, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Completed) {
            return;
        }

        event(new RetroCompleted($retro));
    }
}
