<?php

namespace App\Actions\TeamSurveys;

use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Events\TeamSurveys\TeamSurveyChanged;
use App\Models\TeamSurvey;
use Illuminate\Validation\ValidationException;

class ChangeTeamSurveyStatus
{
    /**
     * Runs inside the caller's transaction, on a survey row locked for update.
     */
    public function handle(TeamSurvey $locked, TeamSurveyStatus $target): void
    {
        $changes = match ([$locked->status, $target]) {
            [TeamSurveyStatus::Draft, TeamSurveyStatus::Open] => $this->publish($locked),
            [TeamSurveyStatus::Open, TeamSurveyStatus::Draft] => $this->backToDraft($locked),
            [TeamSurveyStatus::Open, TeamSurveyStatus::Closed] => ['closed_at' => now()],
            [TeamSurveyStatus::Closed, TeamSurveyStatus::Open] => $this->reopen($locked),
            default => throw ValidationException::withMessages(['status' => __('This change is not possible.')]),
        };

        $locked->fill([...$changes, 'status' => $target]);
        $locked->version++;
        $locked->save();

        TeamSurveyChanged::for($locked)->sendToOthers();
    }

    /**
     * @return array<string, mixed>
     */
    private function publish(TeamSurvey $locked): array
    {
        if (! $locked->questions()->exists()) {
            throw ValidationException::withMessages(['status' => __('Add a question before publishing.')]);
        }

        return ['opened_at' => $locked->opened_at ?? now()];
    }

    /**
     * @return array<string, mixed>
     */
    private function backToDraft(TeamSurvey $locked): array
    {
        if ($locked->hasAnswers()) {
            throw ValidationException::withMessages(['status' => __('This survey already has answers.')]);
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function reopen(TeamSurvey $locked): array
    {
        if ($locked->retro?->phase === RetroPhase::Completed) {
            throw ValidationException::withMessages(['status' => __('An attached health check cannot be reopened once its retro is completed.')]);
        }

        return ['closed_at' => null];
    }
}
