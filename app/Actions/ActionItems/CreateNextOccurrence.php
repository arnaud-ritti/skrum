<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemRecurrence;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class CreateNextOccurrence
{
    public function __construct(private CreateActionItem $createActionItem) {}

    /**
     * Completion-based: one successor per occurrence (the caller holds the
     * row lock; previous_occurrence_id is unique), due one interval later,
     * moved forward until it is not already overdue, and detached from any
     * retro so completed retros never grow.
     */
    public function handle(ActionItem $completed): ?ActionItem
    {
        if ($completed->recurrence === null || $completed->due_on === null) {
            return null;
        }

        if ($completed->nextOccurrence()->exists()) {
            return null;
        }

        return $this->createActionItem->handle(
            $completed->team,
            null,
            new ActionItemActor($completed->author, $completed->createdByParticipant),
            [
                'content' => $completed->content,
                'priority' => $completed->priority->value,
                'due_on' => $this->nextDueOn($completed->recurrence, $completed->due_on)->toDateString(),
                'recurrence' => $completed->recurrence->value,
                'assignee_user_id' => $this->keptAssignee($completed),
                'previous_occurrence_id' => $completed->id,
                'theme_name' => $completed->theme_name,
                'subtasks' => $completed->subtasks->map(fn (ActionItemSubtask $subtask) => $subtask->content)->values()->all(),
            ],
            $completed->theme,
        );
    }

    private function nextDueOn(ActionItemRecurrence $recurrence, CarbonInterface $dueOn): CarbonImmutable
    {
        $today = ActionItem::today()->toDateString();
        $next = $recurrence->advance(CarbonImmutable::parse($dueOn->toDateString()));

        while ($next->toDateString() < $today) {
            $next = $recurrence->advance($next);
        }

        return $next;
    }

    /**
     * Guests, members who left the team and deactivated accounts are not carried over.
     */
    private function keptAssignee(ActionItem $completed): ?string
    {
        $userId = $completed->assignee_user_id;

        if ($userId === null) {
            return null;
        }

        return $completed->team->members()->whereKey($userId)->whereNull('deactivated_at')->exists() ? $userId : null;
    }
}
