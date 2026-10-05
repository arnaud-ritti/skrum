<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

function teamViewer(Team $team, string $who): User
{
    return match ($who) {
        'manager' => workspaceManager($team->workspace),
        'workspace member' => workspaceMember($team->workspace),
        'admin of another workspace' => workspaceManager(Workspace::factory()->create()),
        'outsider' => User::factory()->create(),
        default => teamMember($team, TeamRole::from($who)),
    };
}

it('answers each team ability by role', function (string $ability, array $allowed) {
    $team = Team::factory()->create();

    foreach (['manager', 'owner', 'facilitator', 'member', 'observer', 'workspace member', 'admin of another workspace', 'outsider'] as $who) {
        expect(teamViewer($team, $who)->can($ability, $team))->toBe(in_array($who, $allowed, true), "{$ability} for {$who}");
    }
})->with([
    'view' => ['view', ['manager', 'owner', 'facilitator', 'member', 'observer']],
    'update' => ['update', ['manager', 'owner']],
    'delete' => ['delete', ['manager']],
    'manageMembers' => ['manageMembers', ['manager', 'owner']],
    'invite' => ['invite', ['manager', 'owner', 'facilitator']],
    'manageRituals' => ['manageRituals', ['manager', 'owner', 'facilitator']],
    'takeControl' => ['takeControl', ['manager', 'owner', 'facilitator']],
    'manageIntegrations' => ['manageIntegrations', ['manager', 'owner']],
    'createRetro' => ['createRetro', ['manager', 'owner', 'facilitator', 'member']],
    'createPokerGame' => ['createPokerGame', ['manager', 'owner', 'facilitator', 'member']],
    'createWhiteboard' => ['createWhiteboard', ['manager', 'owner', 'facilitator', 'member']],
    'createGameRoom' => ['createGameRoom', ['manager', 'owner', 'facilitator', 'member']],
    'createSurvey' => ['createSurvey', ['manager', 'owner', 'facilitator', 'member']],
]);
