<?php

use App\Actions\Games\TeamGameLeaderboard;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\BuildSummaryInput;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\RetroPhase;
use App\Enums\SurveyKind;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Survey;
use App\Models\SurveyTextAnswer;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
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

/**
 * Two rows of the same name, the one written first holding the greater id.
 *
 * @return array{0: string, 1: string}
 */
function reversedIds(): array
{
    return ['00000000-0000-7000-8000-000000000002', '00000000-0000-7000-8000-000000000001'];
}

it('lists two members of a workspace who share a name by id on every engine', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    $admin->forceFill(['name' => 'Zoe'])->save();

    foreach (reversedIds() as $id) {
        $workspace->members()->attach(User::factory()->create(['id' => $id, 'name' => 'Sam']), ['role' => WorkspaceRole::Member->value]);
    }

    $this->actingAs($admin)
        ->get(route('workspaces.members.index', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('members.0.id', '00000000-0000-7000-8000-000000000001')
            ->where('members.1.id', '00000000-0000-7000-8000-000000000002')
            ->where('members.2.name', 'Zoe'));
});

it('lists two members of a team who share a name by id on the board on every engine', function () {
    $retro = Retro::factory()->create();
    [$viewer, $participant] = retroMember($retro);
    $viewer->forceFill(['name' => 'Zoe'])->save();

    foreach (reversedIds() as $id) {
        $member = User::factory()->create(['id' => $id, 'name' => 'Sam']);
        $retro->team->workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $retro->team->members()->attach($member);
    }

    $snapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant);

    expect(array_column($snapshot['teamMembers'], 'id'))
        ->toBe(['00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000002', $viewer->id]);
});

it('lists a team deck and a workspace deck of the same name by id on every engine', function () {
    $team = Team::factory()->create();
    [$teamDeckId, $workspaceDeckId] = reversedIds();
    SavedPokerDeck::factory()->create(['id' => $teamDeckId, 'team_id' => $team->id, 'name' => 'Fibonacci']);
    SavedPokerDeck::factory()->forWorkspace($team->workspace)->create(['id' => $workspaceDeckId, 'name' => 'Fibonacci']);
    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    [$member] = pokerFacilitator($game);

    $this->actingAs($member)
        ->get(route('teams.pokerDecks.index', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('savedDecks.0.id', $workspaceDeckId)->where('savedDecks.1.id', $teamDeckId));

    $this->actingAs($member)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('pokerDecks.0.id', $workspaceDeckId)->where('pokerDecks.1.id', $teamDeckId));

    $this->actingAs($member)
        ->getJson(route('poker.saved-decks.index', $game))
        ->assertJsonPath('0.id', $workspaceDeckId)
        ->assertJsonPath('1.id', $teamDeckId);
});

it('lists the members on an invitation alphabetically on every engine', function () {
    $workspace = Workspace::factory()->create();

    foreach (['Zoe', 'adam', 'Émile'] as $name) {
        $workspace->members()->attach(User::factory()->create(['name' => $name]), ['role' => WorkspaceRole::Member->value]);
    }

    WorkspaceInvitation::factory()->withToken('secret-token')->create(['workspace_id' => $workspace->id]);

    $this->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('members.0.name', 'adam')->where('members.1.name', 'Émile')->where('members.2.name', 'Zoe'));
});

it('shows the text answers of a survey on the board alphabetically on every engine', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $survey = Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Text, 'is_closed' => true]);

    foreach (['Zero meetings', 'automate', 'Écouter'] as $content) {
        SurveyTextAnswer::factory()->create(['survey_id' => $survey->id, 'content' => $content]);
    }

    $payload = resolve(PresentSurvey::class)->handle($survey->fresh(), $retro->fresh(), $viewer);

    expect(array_column($payload['textAnswers'], 'text'))->toBe(['automate', 'Écouter', 'Zero meetings']);
});

it('names the participants of a recap alphabetically on every engine', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();

    foreach (['Zoe', 'adam', 'Émile'] as $name) {
        Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => $name])->id]);
    }

    expect(resolve(BuildRetroRecap::class)->handle($retro->fresh())->participantNames)->toBe(['adam', 'Émile', 'Zoe']);
});
