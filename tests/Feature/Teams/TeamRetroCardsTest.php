<?php

use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function teamRetroCardsPage(mixed $test, Team $team): mixed
{
    return $test->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]));
}

it('names a retro after its built-in template', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->create(['template' => 'start_stop_continue']);

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->where('retros.0.templateName', TemplateCatalogue::find('start_stop_continue')->name()));
});

it('names a retro after its workspace template', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create(['name' => 'Our own format']);
    Retro::factory()->for($team)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $template->id]);

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->where('retros.0.templateName', 'Our own format'));
});

it('names a retro whose workspace template was deleted Workspace template', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create();
    Retro::factory()->for($team)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $template->id]);
    $template->delete();

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->where('retros.0.templateName', 'Workspace template'));
});

it('gives the facilitator of a retro, or null', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['title' => 'With']);
    $facilitator = Participant::factory()->create(['retro_id' => $retro->id]);
    $retro->update(['facilitator_participant_id' => $facilitator->id]);
    $this->travelTo(now()->subDay());
    Retro::factory()->for($team)->create(['title' => 'Without']);
    $this->travelBack();

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->where('retros.0.title', 'With')
        ->where('retros.0.facilitator.name', $facilitator->user->name)
        ->where('retros.0.facilitator.avatarUrl', $facilitator->avatarUrl())
        ->where('retros.1.facilitator', null));
});

it('gives the ROTI average only for a completed retro with votes', function () {
    $team = Team::factory()->create();
    $this->travelTo(now()->subDays(3));
    $voted = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $this->travelTo(now()->addDay());
    $unvoted = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $this->travelTo(now()->addDay());
    $open = Retro::factory()->for($team)->create();
    $this->travelBack();

    foreach ([4, 5, 4] as $score) {
        RotiVote::factory()->create(['retro_id' => $voted->id, 'score' => $score]);
    }
    RotiVote::factory()->create(['retro_id' => $open->id, 'score' => 5]);

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->where('retros.2.id', $voted->id)
        ->where('retros.2.rotiAverage', 4.3)
        ->where('retros.1.id', $unvoted->id)
        ->where('retros.1.rotiAverage', null)
        ->where('retros.0.id', $open->id)
        ->where('retros.0.rotiAverage', null));
});

it('tells which open retros the viewer has already joined', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $this->travelTo(now()->subDays(2));
    $closed = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $this->travelTo(now()->addDay());
    $joined = Retro::factory()->for($team)->create();
    $this->travelBack();
    $notJoined = Retro::factory()->for($team)->create();

    Participant::factory()->create(['retro_id' => $closed->id, 'user_id' => $viewer->id]);
    Participant::factory()->create(['retro_id' => $joined->id, 'user_id' => $viewer->id]);
    Participant::factory()->create(['retro_id' => $notJoined->id]);
    Participant::factory()->guest()->create(['retro_id' => $notJoined->id]);

    $this->actingAs($viewer)->get(route('teams.show', [$team->workspace, $team]))->assertInertia(fn (Assert $page) => $page
        ->where('retros.0.id', $notJoined->id)
        ->where('retros.0.viewerHasJoined', false)
        ->where('retros.1.id', $joined->id)
        ->where('retros.1.viewerHasJoined', true)
        ->where('retros.2.id', $closed->id)
        ->where('retros.2.viewerHasJoined', false));
});

it('reads the participants of the viewer only, and of this team only', function () {
    $team = Team::factory()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $viewer = teamMember($team);
    $colleague = teamMember($team);
    $otherTeam->members()->attach($viewer);
    $retro = Retro::factory()->for($team)->create();
    $elsewhere = Retro::factory()->for($otherTeam)->create();

    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $colleague->id]);
    Participant::factory()->create(['retro_id' => $elsewhere->id, 'user_id' => $viewer->id]);

    $this->actingAs($viewer)->get(route('teams.show', [$team->workspace, $team]))->assertInertia(fn (Assert $page) => $page
        ->has('retros', 1)
        ->where('retros.0.id', $retro->id)
        ->where('retros.0.viewerHasJoined', false));

    $this->actingAs($colleague)->get(route('teams.show', [$team->workspace, $team]))->assertInertia(fn (Assert $page) => $page
        ->where('retros.0.viewerHasJoined', true));

    $this->actingAs($viewer)->get(route('teams.show', [$otherTeam->workspace, $otherTeam]))->assertInertia(fn (Assert $page) => $page
        ->has('retros', 1)
        ->where('retros.0.id', $elsewhere->id)
        ->where('retros.0.viewerHasJoined', true));
});

it('defers the number of players online of the games that are not ended', function () {
    $team = Team::factory()->create();
    $active = PokerGame::factory()->create(['team_id' => $team->id]);
    PokerGame::factory()->ended()->create(['team_id' => $team->id]);
    fakePokerRoster(['a', 'b']);

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->missing('pokerPresence')
        ->loadDeferredProps('presence', fn (Assert $reload) => $reload
            ->where('pokerPresence', [$active->id => 2])));
});

it('gives null when the roster cannot be read', function () {
    $team = Team::factory()->create();
    PokerGame::factory()->create(['team_id' => $team->id]);
    fakePokerRoster(null);

    teamRetroCardsPage($this, $team)->assertInertia(fn (Assert $page) => $page
        ->loadDeferredProps('presence', fn (Assert $reload) => $reload
            ->where('pokerPresence', null)));
});

it('keeps the team page query count constant as retros grow', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $seed = function (int $count) use ($team): void {
        Retro::factory()->for($team)->count($count)->create()->each(function (Retro $retro): void {
            $facilitator = Participant::factory()->create(['retro_id' => $retro->id]);
            $retro->update(['facilitator_participant_id' => $facilitator->id, 'completed_at' => now(), 'phase' => RetroPhase::Completed]);
            RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);
        });
    };
    $countQueries = function () use ($team, $user): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($user)->get(route('teams.show', [$team->workspace, $team]))->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $countQueries();
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
