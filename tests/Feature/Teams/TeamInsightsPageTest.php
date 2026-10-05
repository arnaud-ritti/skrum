<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the ROTI of each completed retro, newest first', function () {
    $team = Team::factory()->create();
    $old = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Old', 'completed_at' => '2026-09-01 10:00:00']);
    RotiVote::factory()->for($old)->create(['score' => 3]);
    $new = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'New', 'completed_at' => '2026-09-15 10:00:00']);
    RotiVote::factory()->for($new)->create(['score' => 4]);
    RotiVote::factory()->for($new)->create(['score' => 5]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'No vote', 'completed_at' => '2026-09-20 10:00:00']);
    RotiVote::factory()->for(Retro::factory()->for($team)->inPhase(RetroPhase::Roti)->create(['title' => 'Still voting']))->create();
    RotiVote::factory()->for(Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => '2026-09-25 10:00:00']))->create();
    $this->travel(1)->days();
    $old->touch();

    $this->actingAs(teamMember($team))
        ->get(route('teams.insights.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/insights')
            ->where('workspace.slug', $team->workspace->slug)
            ->where('team', ['id' => $team->id, 'name' => $team->name])
            ->has('retros', 2)
            ->where('retros.0', [
                'id' => $new->id,
                'title' => 'New',
                'url' => route('retros.show', $new),
                'roti' => 4.5,
                'closedOn' => '2026-09-15',
            ])
            ->where('retros.1.title', 'Old')
            ->where('retros.1.roti', 3)
            ->missing('moodTrend'));
});

it('loads the mood trend after the page', function () {
    $team = Team::factory()->create();

    $page = $this->actingAs(teamMember($team))
        ->get(route('teams.insights.show', [$team->workspace, $team]))
        ->viewData('page');

    expect($page['deferredProps']['trend'])->toBe(['moodTrend']);
});
