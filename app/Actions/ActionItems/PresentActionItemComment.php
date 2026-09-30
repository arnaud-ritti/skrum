<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemComment;

class PresentActionItemComment
{
    public function __construct(private ActionItemPermissions $permissions) {}

    /**
     * Comment authors are always named, also on anonymous retros.
     *
     * @return array{
     *     id: string,
     *     actionItemId: string,
     *     content: string,
     *     author: ?array{name: string, avatarUrl: string},
     *     isMine: bool,
     *     createdAt: ?string,
     *     updatedAt: ?string
     * }
     */
    public function handle(ActionItemComment $comment, ?ActionItemActor $viewer = null): array
    {
        return [
            'id' => $comment->id,
            'actionItemId' => $comment->action_item_id,
            'content' => $comment->content,
            'author' => $this->author($comment),
            'isMine' => $viewer !== null && $this->permissions->isCommentAuthor($comment, $viewer),
            'createdAt' => $comment->created_at?->toIso8601String(),
            'updatedAt' => $comment->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<ActionItemComment>  $comments
     * @return array<int, array<string, mixed>>
     */
    public function many(iterable $comments, ?ActionItemActor $viewer = null): array
    {
        $presented = [];

        foreach ($comments as $comment) {
            $presented[] = $this->handle($comment, $viewer);
        }

        return $presented;
    }

    /**
     * @return ?array{name: string, avatarUrl: string}
     */
    private function author(ActionItemComment $comment): ?array
    {
        $participant = $comment->authorParticipant;

        if ($participant !== null) {
            return ['name' => $participant->displayName(), 'avatarUrl' => $participant->avatarUrl()];
        }

        $user = $comment->authorUser;

        if ($user === null) {
            return null;
        }

        return ['name' => $user->name, 'avatarUrl' => $user->avatarUrl()];
    }
}
