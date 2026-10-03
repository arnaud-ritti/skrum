<?php

namespace App\Policies;

use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

class PokerDeckPolicy
{
    public function viewAny(User $user, Team $team): bool
    {
        return $user->can('view', $team);
    }

    public function create(User $user, Team $team): bool
    {
        return $user->can('createPokerGame', $team);
    }

    public function createForWorkspace(User $user, Workspace $workspace): bool
    {
        return $user->canManage($workspace);
    }

    public function update(User $user, SavedPokerDeck $deck): Response
    {
        return $this->manage($user, $deck);
    }

    public function delete(User $user, SavedPokerDeck $deck): Response
    {
        return $this->manage($user, $deck);
    }

    private function manage(User $user, SavedPokerDeck $deck): Response
    {
        if ($deck->isWorkspaceDeck()) {
            return $user->canManage($deck->workspace)
                ? Response::allow()
                : Response::deny(__('Only a workspace admin can change a workspace deck.'));
        }

        if ($user->canManage($deck->team->workspace)) {
            return Response::allow();
        }

        if ($deck->created_by_user_id === $user->id && $user->can('createPokerGame', $deck->team)) {
            return Response::allow();
        }

        return Response::deny(__("Only the deck's creator or a workspace admin can change it."));
    }
}
