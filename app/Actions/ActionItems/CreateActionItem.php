<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;

class CreateActionItem
{
    public function handle(
        Retro $locked,
        Participant $author,
        string $content,
        ?string $assigneeParticipantId = null,
        ?RetroTheme $theme = null,
    ): ActionItem {
        $actionItem = $locked->actionItems()->create([
            'team_id' => $locked->team_id,
            'content' => $content,
            'priority' => ActionItemPriority::Medium->value,
            'assignee_participant_id' => $assigneeParticipantId,
            'created_by_participant_id' => $author->id,
            'created_by_user_id' => $author->user_id,
            'theme_id' => $theme?->id,
            'theme_name' => $theme?->name,
        ]);

        $actionItem->load('assigneeParticipant.user');

        return $actionItem;
    }
}
