<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Events\ActionItems\ActionItemCreated;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\Team;
use Illuminate\Validation\ValidationException;

class CreateActionItem
{
    public function __construct(private BroadcastActionItemChange $broadcastActionItemChange) {}

    /**
     * Callers authorize: board participants while discussing, promotions
     * through SuggestionGuard, team members outside a retro, and
     * CreateNextOccurrence for recurring successors.
     *
     * @param  array<string, mixed>  $attributes  content, and optionally priority, due_on, recurrence, assignee_user_id, assignee_participant_id; from the system only: previous_occurrence_id, theme_name, subtasks
     */
    public function handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null): ActionItem
    {
        $recurrence = $attributes['recurrence'] ?? null;
        $dueOn = $attributes['due_on'] ?? null;

        if ($recurrence !== null && $dueOn === null) {
            throw ValidationException::withMessages([
                'recurrence' => __('A recurring action item needs a due date.'),
            ]);
        }

        $themeName = $theme === null ? ($attributes['theme_name'] ?? null) : $theme->name;

        $actionItem = ActionItem::query()->create([
            'team_id' => $team->id,
            'retro_id' => $retro?->id,
            'content' => $attributes['content'],
            'priority' => $attributes['priority'] ?? ActionItemPriority::Medium->value,
            'due_on' => $dueOn,
            'recurrence' => $recurrence,
            'previous_occurrence_id' => $attributes['previous_occurrence_id'] ?? null,
            'assignee_user_id' => $attributes['assignee_user_id'] ?? null,
            'assignee_participant_id' => $attributes['assignee_participant_id'] ?? null,
            'created_by_participant_id' => $author->participant?->id,
            'created_by_user_id' => $author->user?->id,
            'theme_id' => $theme?->id,
            'theme_name' => $themeName,
        ]);

        /** @var array<int, string> $subtasks */
        $subtasks = $attributes['subtasks'] ?? [];

        foreach (array_values($subtasks) as $position => $content) {
            $actionItem->subtasks()->create(['content' => $content, 'position' => $position]);
        }

        ActionItemCreated::dispatch($actionItem);

        $this->broadcastActionItemChange->saved($actionItem);

        return $actionItem;
    }
}
