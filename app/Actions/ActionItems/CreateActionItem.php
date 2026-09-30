<?php

namespace App\Actions\ActionItems;

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
            'content' => $content,
            'assignee_participant_id' => $assigneeParticipantId,
            'created_by_participant_id' => $author->id,
            'theme_id' => $theme?->id,
            'theme_name' => $theme?->name,
        ]);

        $actionItem->load('assignee.user');

        return $actionItem;
    }
}
