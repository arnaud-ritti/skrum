<?php

namespace App\Http\Controllers;

use App\Actions\Onboarding\StartOnboarding;
use App\Models\TeamInviteLink;
use App\Support\Invitations\InviteLinkSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CurrentWorkspaceController extends Controller
{
    public function show(Request $request, StartOnboarding $startOnboarding): RedirectResponse
    {
        $user = $request->user();
        $linkToken = $request->session()->get(InviteLinkSession::Key);

        if (TeamInviteLink::findByToken($linkToken)?->isUsable() === true) {
            return to_route('inviteLinks.show', $linkToken);
        }

        $onboarding = $user->onboarding()->first();

        if ($onboarding !== null && ! $onboarding->isCompleted()) {
            return to_route('onboarding.show');
        }

        $workspace = $user->workspaces()->whereKey($user->current_workspace_id)->first()
            ?? $user->workspaces()->orderBy('name')->orderBy('workspaces.id')->first();

        if ($workspace === null) {
            $startOnboarding->handle($user);

            return to_route('onboarding.show');
        }

        $teams = $workspace->teamsVisibleTo($user);
        $team = $teams->firstWhere('id', $request->session()->get('current_team_id')) ?? $teams->first();

        if ($team === null) {
            return to_route('workspaces.show', $workspace);
        }

        return to_route('teams.show', [$workspace, $team]);
    }
}
