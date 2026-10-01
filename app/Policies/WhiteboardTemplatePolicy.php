<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WhiteboardTemplate;
use Illuminate\Auth\Access\Response;

class WhiteboardTemplatePolicy
{
    public function update(User $user, WhiteboardTemplate $template): Response
    {
        return $this->manage($user, $template);
    }

    public function delete(User $user, WhiteboardTemplate $template): Response
    {
        return $this->manage($user, $template);
    }

    private function manage(User $user, WhiteboardTemplate $template): Response
    {
        if ($user->canManage($template->workspace)) {
            return Response::allow();
        }

        if ($template->created_by_user_id === $user->id && $user->belongsToWorkspace($template->workspace)) {
            return Response::allow();
        }

        return Response::deny(__('Only the creator of this template or a workspace admin can change it.'));
    }
}
