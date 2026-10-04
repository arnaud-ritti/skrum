<?php

use App\Enums\IntegrationProvider;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira);
});

it('previews the export of a workspace item for its author and refuses a visitor, another team and another workspace', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $workspace = $retro->team->workspace;
    $otherTeamMember = teamMember(Team::factory()->for($workspace)->create());
    $outsider = teamMember(Team::factory()->create());
    $url = route('workspaces.actionItemExports.preview', [$workspace, $item, 'source' => 'jira']);

    $this->getJson($url)->assertUnauthorized();
    $this->actingAs($author)->getJson($url)->assertOk()->assertJsonPath('assignee.state', 'none');
    $this->actingAs($otherTeamMember)->getJson($url)->assertNotFound();
    $this->actingAs($outsider)->getJson($url)->assertForbidden();
});

it('lists the comments of a workspace item for a team member and refuses a visitor and another workspace', function () {
    [$retro, $item, $author] = exportBoardItem();
    $workspace = $retro->team->workspace;
    $outsider = teamMember(Team::factory()->create());
    $url = route('workspaces.actionItemComments.index', [$workspace, $item]);

    $this->getJson($url)->assertUnauthorized();
    $this->actingAs($author)->getJson($url)->assertOk()->assertJsonCount(0, 'comments');
    $this->actingAs($outsider)->getJson($url)->assertForbidden();
});

it('sends a visitor of the action items page to the login and refuses another workspace', function () {
    [$retro] = exportBoardItem();
    $outsider = teamMember(Team::factory()->create());
    $url = route('workspaces.actionItems.index', $retro->team->workspace);

    $this->get($url)->assertRedirect(route('login'));
    $this->actingAs($outsider)->get($url)->assertForbidden();
});
