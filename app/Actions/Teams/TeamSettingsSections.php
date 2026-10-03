<?php

namespace App\Actions\Teams;

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\User;

class TeamSettingsSections
{
    /**
     * Which tabs of the team settings this person may open, and where the entry leads.
     *
     * @return array{general: bool, members: bool, integrations: bool, data: bool, firstUrl: ?string}
     */
    public function handle(User $user, Team $team): array
    {
        $general = $user->can('update', $team);
        $members = $user->can('manageRituals', $team);
        $integrations = IntegrationProvider::anyEnabled() && $user->can('manageIntegrations', $team);
        $scope = [$team->workspace, $team];

        $firstUrl = match (true) {
            $general => route('teams.settings.show', $scope),
            $members => route('teams.members.index', $scope),
            $integrations => route('teams.integrations.index', $scope),
            default => null,
        };

        return [
            'general' => $general,
            'members' => $members,
            'integrations' => $integrations,
            'data' => $general,
            'firstUrl' => $firstUrl,
        ];
    }
}
