<?php

namespace App\Actions\Retros;

use App\Actions\Games\AbandonIcebreakerRound;
use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\HealthCheck\CloseAttachedSurveys;
use App\Actions\Surveys\CloseOpenSurveys;
use App\Enums\RetroPhase;
use App\Events\RetroCompleted;
use App\Events\Retros\PhaseChanged;
use App\Models\Retro;
use App\Support\Llm\Llm;
use Illuminate\Validation\ValidationException;

class ChangeRetroPhase
{
    public function __construct(
        private CloseOpenSurveys $closeOpenSurveys,
        private CloseAttachedSurveys $closeAttachedSurveys,
        private Llm $llm,
        private QueueRetroSummary $queueRetroSummary,
        private ClearRetroInsights $clearRetroInsights,
        private AbandonIcebreakerRound $abandonIcebreakerRound,
        private EnsureIcebreakerRoom $ensureIcebreakerRoom,
        private MarkRetroStarted $markRetroStarted,
    ) {}

    /**
     * Runs inside the caller's transaction, on a retro row locked for update.
     */
    public function handle(Retro $locked, RetroPhase $phase): void
    {
        $this->ensureReachable($locked, $phase);
        $this->abandonSummary($locked, $phase);
        $this->leaveIcebreaker($locked, $phase);
        $this->move($locked, $phase);
        $this->resetVotingCompletion($locked, $phase);
        $this->markRetroStarted->handle($locked);
        $this->enterIcebreaker($locked, $phase);
        $this->closeSurveys($locked, $phase);
        $this->broadcast($locked, $phase);
        $this->announceCompletion($locked, $phase);
        $this->queueSummary($locked, $phase);
    }

    private function ensureReachable(Retro $locked, RetroPhase $phase): void
    {
        if ($locked->canMoveTo($phase)) {
            return;
        }

        throw ValidationException::withMessages(['phase' => __('The retrospective can only move to the previous or next phase.')]);
    }

    /**
     * A summary queued before a reopen must not run later, even once completed again.
     */
    private function abandonSummary(Retro $locked, RetroPhase $phase): void
    {
        if ($locked->phase !== RetroPhase::Completed) {
            return;
        }

        if ($phase === RetroPhase::Completed) {
            return;
        }

        $this->clearRetroInsights->abandon($locked);
    }

    /**
     * Read before the move: the phase being left is still on the row.
     */
    private function leaveIcebreaker(Retro $locked, RetroPhase $phase): void
    {
        if ($locked->phase !== RetroPhase::Icebreaker) {
            return;
        }

        if ($phase === RetroPhase::Icebreaker) {
            return;
        }

        $this->abandonIcebreakerRound->handle($locked);
    }

    private function enterIcebreaker(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Icebreaker) {
            return;
        }

        $this->ensureIcebreakerRoom->handle($locked);
    }

    private function move(Retro $locked, RetroPhase $phase): void
    {
        $isCompleting = $phase === RetroPhase::Completed;
        $keepsHighlight = $locked->phase->showsTopics() && $phase->showsTopics();

        $locked->update([
            'phase' => $phase,
            'highlighted_card_id' => $keepsHighlight ? $locked->highlighted_card_id : null,
            'completed_at' => $isCompleting ? now() : null,
            'timer_ends_at' => $isCompleting ? null : $locked->timer_ends_at,
            'timer_paused_seconds' => $isCompleting ? null : $locked->timer_paused_seconds,
            'topic_seconds' => $isCompleting ? null : $locked->topic_seconds,
            'roti_revealed_at' => $phase === RetroPhase::Roti ? null : $locked->roti_revealed_at,
        ]);
    }

    /**
     * A voting round starts with nobody finished; going back to Voting is a new round.
     */
    private function resetVotingCompletion(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Voting) {
            return;
        }

        $locked->participants()->whereNotNull('voting_finished_at')->update(['voting_finished_at' => null]);
    }

    private function closeSurveys(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Completed) {
            return;
        }

        $this->closeOpenSurveys->handle($locked);
        $this->closeAttachedSurveys->handle($locked);
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

    private function queueSummary(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Completed) {
            return;
        }

        if (! $locked->ai_summary_enabled) {
            return;
        }

        if (! $this->llm->isConfigured()) {
            return;
        }

        $this->queueRetroSummary->handle($locked);
    }
}
