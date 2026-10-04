<?php

namespace App\Actions\ActionItems;

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Database\Query\Builder;

class ActionItemPermissions
{
    public function canCreateWithoutRetro(User $user, Team $team): bool
    {
        if (! $team->hasMember($user)) {
            return false;
        }

        return ! $user->isObserverOf($team);
    }

    /**
     * An observer of the team is read-only on its items (plan 23 decision 3), even on one
     * they wrote before becoming observer.
     */
    public function canEdit(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isObserver($item, $actor)) {
            return false;
        }

        return $this->isManager($item, $actor);
    }

    public function canDelete(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isObserver($item, $actor)) {
            return false;
        }

        return $this->isManager($item, $actor);
    }

    public function canComplete(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isObserver($item, $actor)) {
            return false;
        }

        if ($this->isManager($item, $actor)) {
            return true;
        }

        if ($this->isAssignee($item, $actor)) {
            return true;
        }

        return $this->isReviewFacilitator($item, $actor);
    }

    public function canComment(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isObserver($item, $actor)) {
            return false;
        }

        if ($actor->participant !== null && $item->retro_id !== null && $actor->participant->retro_id === $item->retro_id) {
            return true;
        }

        return $actor->user?->can('view', $item->team) ?? false;
    }

    public function canEditComment(ActionItemComment $comment, ActionItemActor $actor): bool
    {
        if ($this->isObserver($comment->actionItem, $actor)) {
            return false;
        }

        return $this->isCommentAuthor($comment, $actor);
    }

    public function canDeleteComment(ActionItemComment $comment, ActionItemActor $actor): bool
    {
        if ($this->isObserver($comment->actionItem, $actor)) {
            return false;
        }

        if ($this->isCommentAuthor($comment, $actor)) {
            return true;
        }

        return $this->canDelete($comment->actionItem, $actor);
    }

    public function authorizeCreateWithoutRetro(User $user, Team $team): void
    {
        if ($this->canCreateWithoutRetro($user, $team)) {
            return;
        }

        throw new AuthorizationException(__('Only team members can add action items to this team.'));
    }

    public function authorizeEdit(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canEdit($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the author, the facilitator or an admin can change this action item.'));
    }

    public function authorizeDelete(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canDelete($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the author, the facilitator or an admin can change this action item.'));
    }

    public function authorizeComplete(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canComplete($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the assignee or a manager can complete this action item.'));
    }

    public function authorizeComment(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canComment($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('You cannot comment on this action item.'));
    }

    public function authorizeEditComment(ActionItemComment $comment, ActionItemActor $actor): void
    {
        if ($this->canEditComment($comment, $actor)) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own comments.'));
    }

    public function authorizeDeleteComment(ActionItemComment $comment, ActionItemActor $actor): void
    {
        if ($this->canDeleteComment($comment, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the author of the comment or a manager can delete it.'));
    }

    public function isAuthor(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->participant !== null && $item->created_by_participant_id === $actor->participant->id) {
            return true;
        }

        return $actor->user !== null && $item->created_by_user_id === $actor->user->id;
    }

    public function isCommentAuthor(ActionItemComment $comment, ActionItemActor $actor): bool
    {
        if ($actor->participant !== null && $comment->author_participant_id === $actor->participant->id) {
            return true;
        }

        if ($actor->user === null) {
            return false;
        }

        if ($comment->author_user_id === $actor->user->id) {
            return true;
        }

        return $comment->authorParticipant?->user_id === $actor->user->id;
    }

    private function isManager(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isAuthor($item, $actor)) {
            return true;
        }

        if ($this->isRetroFacilitator($item->retro, $actor)) {
            return true;
        }

        return $actor->user?->canManage($item->team->workspace) ?? false;
    }

    private function isObserver(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->user === null) {
            return false;
        }

        return $actor->user->isObserverOf($item->team);
    }

    private function isAssignee(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->user !== null && $item->assignee_user_id === $actor->user->id) {
            return true;
        }

        return $actor->participant !== null && $item->assignee_participant_id === $actor->participant->id;
    }

    private function isRetroFacilitator(?Retro $retro, ActionItemActor $actor): bool
    {
        if ($retro === null || $retro->facilitator_participant_id === null) {
            return false;
        }

        if ($actor->participant !== null && $retro->facilitator_participant_id === $actor->participant->id) {
            return true;
        }

        if ($actor->user === null) {
            return false;
        }

        return $retro->facilitator->user_id === $actor->user->id;
    }

    /**
     * The facilitator of any running retro of the item's team reviews its
     * follow-ups there, so they may tick them off.
     */
    private function isReviewFacilitator(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->participant !== null && $this->facilitatesRunningRetroOfTeam($actor->participant->retro, $actor->participant->id, $item)) {
            return true;
        }

        if ($actor->user === null) {
            return false;
        }

        $userId = $actor->user->id;

        return Retro::query()
            ->where('team_id', $item->team_id)
            ->where('phase', '!=', RetroPhase::Completed->value)
            ->whereHas('facilitator', fn (Builder $query) => $query->where('user_id', $userId))
            ->exists();
    }

    private function facilitatesRunningRetroOfTeam(Retro $retro, string $participantId, ActionItem $item): bool
    {
        if ($retro->team_id !== $item->team_id) {
            return false;
        }

        if ($retro->phase === RetroPhase::Completed) {
            return false;
        }

        return $retro->facilitator_participant_id === $participantId;
    }
}
