<?php

namespace App\Actions\Retros;

use App\Models\ActionItem;

class PresentActionItem
{
    /**
     * @return array{
     *     id: string,
     *     content: string,
     *     isDone: bool,
     *     assignee: ?array{id: string, name: string},
     *     themeId: ?string,
     *     themeName: ?string
     * }
     */
    public function handle(ActionItem $item): array
    {
        return [
            'id' => $item->id,
            'content' => $item->content,
            'isDone' => $item->completed_at !== null,
            'assignee' => $item->assigneeParticipant === null
                ? null
                : ['id' => $item->assigneeParticipant->id, 'name' => $item->assigneeParticipant->displayName()],
            'themeId' => $item->theme_id,
            'themeName' => $item->theme_name,
        ];
    }
}
