<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemComment;

class AddActionItemComment
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * On a board the participant is the author; from the global page or the
     * carry-over panel the user is.
     */
    public function handle(ActionItem $item, ActionItemActor $actor, string $content): ActionItemComment
    {
        $this->permissions->authorizeComment($item, $actor);

        $comment = $item->comments()->create([
            'author_participant_id' => $actor->participant?->id,
            'author_user_id' => $actor->participant === null ? $actor->user?->id : null,
            'content' => $content,
        ]);

        $comment->load(['authorParticipant.user', 'authorUser']);

        $this->broadcastActionItemChange->commentsChanged($item);

        return $comment;
    }
}
