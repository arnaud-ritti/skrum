<?php

use App\Actions\TeamSurveys\BuildTeamEnps;
use App\Enums\TeamRole;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurveyRespondent;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

it('scores the team question: promoters minus detractors', function () {
    $team = Team::factory()->create();
    $survey = closedEnps($team, [10, 10, 9, 9, 9, 8, 7, 3, 0], Carbon::parse('2026-10-05 16:00:00'));
    $survey->update(['title' => 'eNPS October']);

    $this->actingAs(teamMember($team))
        ->get(route('teams.enps.show', [$team->workspace, $team]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/enps')
            ->where('workspace.slug', $team->workspace->slug)
            ->where('team', ['id' => $team->id, 'name' => $team->name])
            ->has('enps.history', 1)
            ->where('enps.latest', [
                'id' => $survey->id,
                'title' => 'eNPS October',
                'url' => route('surveys.results.show', $survey),
                'closedOn' => '2026-10-05',
                'answers' => 9,
                'score' => 33,
                'change' => null,
                'promoters' => 5,
                'passives' => 2,
                'detractors' => 2,
            ])
            ->where('enps.history.0.id', $survey->id));
});

it('says how the score moved since the survey before', function () {
    $team = Team::factory()->create();
    $older = closedEnps($team, [10, 10, 8, 8, 0], now()->subMonth());
    $newer = closedEnps($team, [10, 10, 9, 9, 9, 8, 7, 3, 0]);

    $enps = resolve(BuildTeamEnps::class)->handle($team);

    expect(array_column($enps['history'], 'id'))->toBe([$newer->id, $older->id])
        ->and(array_column($enps['history'], 'score'))->toBe([33, 20])
        ->and(array_column($enps['history'], 'change'))->toBe([13, null])
        ->and($enps['latest'])->toBe($enps['history'][0]);
});

it('leaves out a draft, an open survey, another template, a survey attached to a retro, another team\'s, and an eNPS survey without its team question', function () {
    $team = Team::factory()->create();

    closedEnps($team, [9, 9, 9])->update(['status' => TeamSurveyStatus::Draft]);
    closedEnps($team, [9, 9, 9])->update(['status' => TeamSurveyStatus::Open, 'closed_at' => null]);
    closedEnps($team, [9, 9, 9])->update(['template' => TeamSurveyTemplate::TeamPulse]);
    closedEnps($team, [9, 9, 9])->update(['retro_id' => Retro::factory()->for($team)->create()->id]);
    closedEnps(Team::factory()->create(), [9, 9, 9]);

    $retyped = closedEnps($team, [9, 9, 9]);
    $retyped->questions()->where('match_key', BuildTeamEnps::TeamQuestion)->sole()->update(['kind' => TeamSurveyQuestionKind::Scale, 'scale_max' => 5]);

    $removed = closedEnps($team, [9, 9, 9]);
    $company = $removed->questions()->where('match_key', 'enps_company')->sole();
    $removed->respondents()->get()->each(fn (TeamSurveyRespondent $respondent) => answerSurveyQuestion($company, $respondent, 9));
    $removed->questions()->where('match_key', BuildTeamEnps::TeamQuestion)->sole()->delete();

    expect(resolve(BuildTeamEnps::class)->handle($team))->toBe(['latest' => null, 'history' => []]);
});

it('does not count an answer to the company question as a team score', function () {
    $team = Team::factory()->create();
    $survey = closedEnps($team, [10, 9, 9]);
    $company = $survey->questions()->where('match_key', 'enps_company')->sole();

    foreach ([0, 0, 0, 0] as $score) {
        answerSurveyQuestion($company, TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id]), $score);
    }

    expect(resolve(BuildTeamEnps::class)->handle($team)['latest'])
        ->toMatchArray(['score' => 100, 'answers' => 3, 'promoters' => 3, 'passives' => 0, 'detractors' => 0]);
});

it('shows no figure of a survey that has fewer answers than its results page asks for', function () {
    $team = Team::factory()->create();
    $counted = closedEnps($team, [10, 8, 0], now()->subMonth());
    closedEnps($team, [10, 10]);

    $history = resolve(BuildTeamEnps::class)->handle($team)['history'];

    expect(array_column($history, 'id'))->toBe([$counted->id])
        ->and($history[0]['change'])->toBeNull();
});

it('keeps the 24 newest', function () {
    $team = Team::factory()->create();
    $oldest = closedEnps($team, [0, 0, 0], now()->subDays(30));

    foreach (range(1, BuildTeamEnps::HistoryLimit) as $daysAgo) {
        closedEnps($team, [10, 10, 10], now()->subDays($daysAgo));
    }

    $history = resolve(BuildTeamEnps::class)->handle($team)['history'];

    expect($history)->toHaveCount(24)
        ->and(array_column($history, 'id'))->not->toContain($oldest->id)
        ->and($history[23]['change'])->toBe(200);
});

it('tells who may start an eNPS survey', function () {
    $team = Team::factory()->create();
    $url = route('teams.enps.show', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->get($url)
        ->assertInertia(fn (Assert $page) => $page
            ->where('canStart', true)
            ->where('startUrl', route('teams.show', [$team->workspace, $team, 'new' => 'survey', 'template' => 'enps']))
            ->where('enps', ['latest' => null, 'history' => []]));

    $this->actingAs(teamMember($team, TeamRole::Observer))->get($url)
        ->assertInertia(fn (Assert $page) => $page->where('canStart', false));
});
