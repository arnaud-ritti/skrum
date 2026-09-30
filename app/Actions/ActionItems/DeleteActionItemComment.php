<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemComment;

class DeleteActionItemComment
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItemComment $comment, ActionItemActor $actor): void
    {
        $this->permissions->authorizeDeleteComment($comment, $actor);

        $item = $comment->actionItem;

        $comment->delete();

        $this->broadcastActionItemChange->commentsChanged($item);
    }
}
