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
            'isDone' => $item->is_done,
            'assignee' => $item->assignee === null
                ? null
                : ['id' => $item->assignee->id, 'name' => $item->assignee->displayName()],
            'themeId' => $item->theme_id,
            'themeName' => $item->theme_name,
        ];
    }
}
