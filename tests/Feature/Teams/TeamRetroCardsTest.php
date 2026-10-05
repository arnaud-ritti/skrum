<?php

use App\Actions\Retros\PresentTeamRetro;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

function teamRetroCardsPage(TestCase $test, Team $team): TestResponse
{
    return $test->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]));
}

/**
 * The card of a retro as `PresentTeamRetro` gives it, which no page reads since the team page lists sessions.
 *
 * @return array<string, mixed>
 */
function teamRetroCard(Retro $retro, ?User $viewer = null): array
{
    return resolve(PresentTeamRetro::class)->handle(Retro::query()
        ->with(['workspaceTemplate', 'facilitator.user'])
        ->withAvg('rotiVotes', 'score')
        ->withExists(['participants as viewer_has_joined' => fn (Builder $participants) => $participants->where('user_id', $viewer?->id)])
        ->findOrFail($retro->id));
}

it('names a retro after its built-in template', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->create(['template' => 'start_stop_continue']);

    expect(teamRetroCard($retro)['templateName'])->toBe(TemplateCatalogue::find('start_stop_continue')->name());
});

it('names a retro after its workspace template', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create(['name' => 'Our own format']);
    $retro = Retro::factory()->for($team)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $template->id]);

    expect(teamRetroCard($retro)['templateName'])->toBe('Our own format');
});

it('names a retro whose workspace template was deleted Workspace template', function () {
    $team = Team::factory()->create();
    $template = WorkspaceTemplate::factory()->for($team->workspace)->create();
    $retro = Retro::factory()->for($team)->create(['template' => TemplateCatalogue::Workspace, 'workspace_template_id' => $template->id]);
    $template->delete();

    expect(teamRetroCard($retro)['templateName'])->toBe('Workspace template');
});

it('gives the facilitator of a retro, or null', function () {
    $team = Team::factory()->create();
    $with = Retro::factory()->for($team)->create();
    $facilitator = Participant::factory()->create(['retro_id' => $with->id]);
    $with->update(['facilitator_participant_id' => $facilitator->id]);
    $without = Retro::factory()->for($team)->create();

    expect(teamRetroCard($with)['facilitator'])->toBe(['name' => $facilitator->user->name, 'avatarUrl' => $facilitator->avatarUrl()])
        ->and(teamRetroCard($without)['facilitator'])->toBeNull();
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

    expect(teamRetroCard($voted)['rotiAverage'])->toBe(4.3)
        ->and(teamRetroCard($unvoted)['rotiAverage'])->toBeNull()
        ->and(teamRetroCard($open)['rotiAverage'])->toBeNull();
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

    expect(teamRetroCard($notJoined, $viewer)['viewerHasJoined'])->toBeFalse()
        ->and(teamRetroCard($joined, $viewer)['viewerHasJoined'])->toBeTrue()
        ->and(teamRetroCard($closed, $viewer)['viewerHasJoined'])->toBeFalse();
});

it('lists on the team page the retros of this team only', function () {
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
        ->has('recentSessions', 1)
        ->where('recentSessions.0.id', $retro->id)
        ->where('recentSessions.0.participants', 1));

    $this->actingAs($viewer)->get(route('teams.show', [$otherTeam->workspace, $otherTeam]))->assertInertia(fn (Assert $page) => $page
        ->has('recentSessions', 1)
        ->where('recentSessions.0.id', $elsewhere->id)
        ->where('recentSessions.0.participants', 1));
});

it('counts the players of a game on its row and no longer defers how many are online', function () {
    $team = Team::factory()->create();
    $active = PokerGame::factory()->create(['team_id' => $team->id]);
    PokerPlayer::factory()->count(2)->create(['poker_game_id' => $active->id]);
    fakePokerRoster(['a', 'b', 'c']);

    $page = teamRetroCardsPage($this, $team)
        ->assertInertia(fn (Assert $page) => $page
            ->missing('pokerPresence')
            ->where('recentSessions.0.id', $active->id)
            ->where('recentSessions.0.participants', 2))
        ->viewData('page');

    expect($page['deferredProps'])->not->toHaveKey('presence');
});

it('answers the team page when the roster cannot be read', function () {
    $team = Team::factory()->create();
    PokerGame::factory()->create(['team_id' => $team->id]);
    fakePokerRoster(null);

    teamRetroCardsPage($this, $team)->assertOk()->assertInertia(fn (Assert $page) => $page->has('recentSessions', 1));
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
