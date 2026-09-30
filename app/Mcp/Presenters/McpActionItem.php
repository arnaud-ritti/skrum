<?php

namespace App\Mcp\Presenters;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Retros\PresentActionItem;
use App\Models\ActionItem;
use App\Models\User;
use Illuminate\Support\Arr;

class McpActionItem
{
    public function __construct(private PresentActionItem $presentActionItem) {}

    /**
     * @return array<int, string>
     */
    public static function relations(): array
    {
        return [...ActionItem::presentationRelations(), 'team.workspace'];
    }

    /**
     * @return array<string, mixed>
     */
    public function handle(ActionItem $item, User $viewer): array
    {
        $presented = $this->presentActionItem->handle($item, ActionItemActor::forUser($viewer));

        return [
            'id' => $presented['id'],
            'boardId' => $presented['retroId'],
            ...Arr::except($presented, ['id', 'retroId']),
            'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
        ];
    }
}
