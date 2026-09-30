<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemComment;

class UpdateActionItemComment
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItemComment $comment, ActionItemActor $actor, string $content): ActionItemComment
    {
        $this->permissions->authorizeEditComment($comment, $actor);

        $comment->update(['content' => $content]);
        $comment->load(['authorParticipant.user', 'authorUser']);

        $this->broadcastActionItemChange->commentsChanged($comment->actionItem);

        return $comment;
    }
}
