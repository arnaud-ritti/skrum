<?php

namespace App\Actions\Retros;

use App\Models\SuggestedAction;

class PresentSuggestedAction
{
    /**
     * @return array{
     *     id: string,
     *     content: string,
     *     themeId: ?string,
     *     status: string,
     *     actionItemId: ?string
     * }
     */
    public function handle(SuggestedAction $suggestion): array
    {
        return [
            'id' => $suggestion->id,
            'content' => $suggestion->content,
            'themeId' => $suggestion->theme_id,
            'status' => $suggestion->status->value,
            'actionItemId' => $suggestion->action_item_id,
        ];
    }
}
