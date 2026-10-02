<?php

use App\Actions\Games\TeamGameLeaderboard;
use App\Actions\Retros\BuildSummaryInput;
use App\Enums\RetroPhase;
use App\Enums\SurveyKind;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyTextAnswer;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Inertia\Testing\AssertableInertia;

it('lists the members of a team alphabetically on every engine', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    foreach (['Zoe', 'adam', 'Émile'] as $name) {
        $member = User::factory()->create(['name' => $name]);
        $team->workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $this->actingAs($admin)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('members.0.name', 'adam')->where('members.1.name', 'Émile')->where('members.2.name', 'Zoe'));
});

it('lists the templates of a workspace alphabetically on every engine', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    foreach (['Zoom out', 'agenda', 'Équipe'] as $name) {
        WorkspaceTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => $name]);
    }

    $this->actingAs($admin)
        ->get(route('workspaces.templates.index', $team->workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('templates.0.name', 'agenda')->where('templates.1.name', 'Équipe')->where('templates.2.name', 'Zoom out'));
});

it('lists the teams a user can see alphabetically on every engine', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);

    foreach (['Zebra', 'apollo', 'Écho'] as $name) {
        Team::factory()->create(['workspace_id' => $workspace->id, 'name' => $name]);
    }

    expect($workspace->teamsVisibleTo($admin)->pluck('name')->all())->toBe(['apollo', 'Écho', 'Zebra']);
});

it('breaks a tie of the game leaderboard alphabetically on every engine', function () {
    $team = Team::factory()->create();
    $room = GameRoom::factory()->create(['team_id' => $team->id]);

    foreach (['Zoe', 'adam', 'Émile'] as $name) {
        [$user, $player] = gameRoomMember($room);
        $user->forceFill(['name' => $name])->save();
        awardGamePoints($room, $player, 5);
    }

    $leaderboard = resolve(TeamGameLeaderboard::class)->handle($team->fresh(), 'all');

    expect(array_column($leaderboard, 'name'))->toBe(['adam', 'Émile', 'Zoe']);
});

it('sends the text answers of a survey to the summary alphabetically on every engine', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    $survey = Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Text, 'is_closed' => true]);

    foreach (['Zero meetings', 'automate', 'Écouter'] as $content) {
        SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'content' => $content]);
    }

    $payload = json_decode(resolve(BuildSummaryInput::class)->handle($retro->fresh())->payload, true);

    expect($payload['surveys'][0]['answers'])->toBe(['automate', 'Écouter', 'Zero meetings']);
});
