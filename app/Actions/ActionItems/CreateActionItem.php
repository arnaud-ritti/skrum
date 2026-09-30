<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Events\ActionItems\ActionItemCreated;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\Team;

class CreateActionItem
{
    public function __construct(private BroadcastActionItemChange $broadcastActionItemChange) {}

    /**
     * Callers authorize: board participants while discussing, promotions
     * through SuggestionGuard, team members outside a retro.
     *
     * @param  array<string, mixed>  $attributes  content, and optionally priority, due_on, assignee_user_id, assignee_participant_id
     */
    public function handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null): ActionItem
    {
        $actionItem = ActionItem::query()->create([
            'team_id' => $team->id,
            'retro_id' => $retro?->id,
            'content' => $attributes['content'],
            'priority' => $attributes['priority'] ?? ActionItemPriority::Medium->value,
            'due_on' => $attributes['due_on'] ?? null,
            'assignee_user_id' => $attributes['assignee_user_id'] ?? null,
            'assignee_participant_id' => $attributes['assignee_participant_id'] ?? null,
            'created_by_participant_id' => $author->participant?->id,
            'created_by_user_id' => $author->user?->id,
            'theme_id' => $theme?->id,
            'theme_name' => $theme?->name,
        ]);

        ActionItemCreated::dispatch($actionItem);

        $this->broadcastActionItemChange->saved($actionItem);

        return $actionItem;
    }
}
