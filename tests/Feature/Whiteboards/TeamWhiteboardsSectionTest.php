<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use Inertia\Testing\AssertableInertia as Assert;

it('lists the team boards on the sessions page, most recently changed first', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->travelTo(now()->subDay());
    $older = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Older']);
    $this->travelBack();

    $newer = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Newer']);
    [$facilitator] = whiteboardFacilitator($newer);
    Whiteboard::factory()->create();

    $this->actingAs($user)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'whiteboard']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/sessions')
            ->where('canCreateWhiteboard', true)
            ->has('sessions', 2)
            ->where('sessions.0.id', $newer->id)
            ->where('sessions.0.title', 'Newer')
            ->where('sessions.0.facilitator', $facilitator->name)
            ->where('sessions.0.updatedAt', $newer->updated_at->utc()->toIso8601String())
            ->where('sessions.0.canDelete', false)
            ->where('sessions.1.id', $older->id)
            ->where('sessions.1.facilitator', null)
            ->where('sessions.1.canDelete', false));
});

it('offers to delete a board to its facilitator and to workspace admins only', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->create(['team_id' => $team->id]);
    [$facilitator] = whiteboardFacilitator($board);
    $orphan = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'No facilitator']);

    $canDelete = fn ($user) => collect($this->actingAs($user)
        ->get(route('teams.sessions.index', [$team->workspace, $team, 'kind' => 'whiteboard']))
        ->assertOk()
        ->inertiaProps('sessions'))->pluck('canDelete', 'id')->all();

    expect($canDelete($facilitator))->toEqual([$orphan->id => false, $board->id => true])
        ->and($canDelete(teamMember($team)))->toEqual([$orphan->id => false, $board->id => false])
        ->and($canDelete(workspaceManager($team->workspace)))->toEqual([$orphan->id => true, $board->id => true]);
});

it('lists the workspace templates by name on the templates page, without their scenes', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $mine = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Zebra', 'description' => 'Stripes', 'created_by_user_id' => $user->id]);
    $theirs = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Alpha']);
    WhiteboardTemplate::factory()->create(['name' => 'Elsewhere']);

    $this->actingAs($user)
        ->get(route('workspaces.templates.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->has('whiteboardTemplates', 2)
            ->where('whiteboardTemplates.0', fn ($template) => collect($template)->except('preview')->all() === ['id' => $theirs->id, 'name' => 'Alpha', 'description' => null, 'canManage' => false])
            ->where('whiteboardTemplates.1', fn ($template) => collect($template)->except('preview')->all() === ['id' => $mine->id, 'name' => 'Zebra', 'description' => 'Stripes', 'canManage' => true])
            ->missing('whiteboardTemplates.0.scene'));

    $this->actingAs(workspaceManager($team->workspace))
        ->get(route('workspaces.templates.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('whiteboardTemplates.0.canManage', true)
            ->where('whiteboardTemplates.1.canManage', true));
});

it('loads the gallery on demand: built-in templates first, then the workspace own', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->forceFill(['locale' => 'de'])->save();
    $preview = ['width' => 10, 'height' => 20, 'shapes' => [['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 10, 'height' => 20, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []]]];
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id, 'name' => 'Ours', 'description' => 'Team format', 'preview' => $preview,
        'scene' => ['elements' => [sceneElement(['id' => 'hidden-from-the-gallery'])], 'files' => []],
    ]);
    WhiteboardTemplate::factory()->create(['name' => 'Elsewhere']);

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('whiteboardGallery')
            ->reloadOnly('whiteboardGallery', fn (Assert $reload) => $reload
                ->has('whiteboardGallery', 9)
                ->where('whiteboardGallery.0.key', 'blank')
                ->where('whiteboardGallery.0.name', 'Leer')
                ->where('whiteboardGallery.0.workspaceTemplateId', null)
                ->where('whiteboardGallery.0.preview', ['width' => 0, 'height' => 0, 'shapes' => []])
                ->where('whiteboardGallery.5.key', 'swot')
                ->where('whiteboardGallery.5.description', 'Stärken, Schwächen, Chancen und Risiken.')
                ->has('whiteboardGallery.5.preview.shapes', 8)
                ->where('whiteboardGallery.8', [
                    'key' => "workspace:{$template->id}",
                    'workspaceTemplateId' => $template->id,
                    'name' => 'Ours',
                    'description' => 'Team format',
                    'preview' => $preview,
                ])));
});

it('shows the team page, and so the templates, to no one outside the workspace', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $guest = whiteboardGuest($board);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertRedirect(route('login'));

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonMissingPath('templates')
        ->assertJsonPath('links.team', null);

    $this->actingAs(workspaceManager(Team::factory()->create()->workspace, WorkspaceRole::Owner))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertForbidden();
});
