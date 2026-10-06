<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\TeamActivityKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\TeamActivity;
use App\Models\TeamSurvey;
use Carbon\CarbonImmutable;
use Tests\Browser\Support\DocsWorld;

const DocsInsightsVoters = ['Camille' => 0, 'Théo' => 1, 'Inès' => 0, 'Malik' => -1, 'Sofia' => 0, 'Noa' => 1, 'Lucas' => 0];

function docsInsightsSprintStart(int $number): CarbonImmutable
{
    return CarbonImmutable::now()->startOfWeek()->subDays(7 + (43 - $number) * 14);
}

/**
 * @param  array<int, int>  $rotiScores
 * @param  array<int, int>  $statementScores
 */
function docsInsightsRetro(DocsWorld $world, int $sprint, array $rotiScores, array $statementScores): Retro
{
    $startedAt = docsInsightsSprintStart($sprint)->addDays(10)->setTime(14, 0);

    $retro = Retro::factory()->for($world->team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'title' => "Sprint {$sprint} retro",
        'created_at' => $startedAt,
        'updated_at' => $startedAt->addHour(),
        'completed_at' => $startedAt->addHour(),
    ]);

    $statements = array_column(HealthStatement::cases(), 'value');

    foreach (array_keys(DocsInsightsVoters) as $index => $firstName) {
        $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $world->person($firstName)->id]);
        $leaning = DocsInsightsVoters[$firstName];

        answerHealthCheck($retro, $participant, array_combine($statements, array_map(fn (int $score): int => max(1, min(5, $score + $leaning)), $statementScores)));
        RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => $rotiScores[$index]]);
    }

    closeHealthCheck($retro);

    return $retro;
}

function docsInsightsHistory(DocsWorld $world): void
{
    foreach ([36, 37, 38, 39, 40] as $number) {
        $startsOn = docsInsightsSprintStart($number);

        teamSprint($world->team, $number, $startsOn->toDateString(), $startsOn->addDays(13)->toDateString());
    }

    docsInsightsRetro($world, 36, [3, 3, 4, 3, 2, 4, 3], [3, 3, 4, 3, 2, 3]);
    docsInsightsRetro($world, 37, [3, 4, 4, 3, 3, 4, 3], [3, 4, 4, 3, 2, 3]);
    docsInsightsRetro($world, 38, [3, 3, 3, 2, 4, 3, 3], [3, 3, 4, 3, 2, 2]);
    docsInsightsRetro($world, 39, [4, 4, 3, 4, 3, 4, 4], [4, 4, 4, 3, 3, 3]);
    docsInsightsRetro($world, 40, [4, 4, 5, 4, 3, 4, 4], [4, 4, 5, 4, 3, 4]);
    docsInsightsRetro($world, 41, [4, 5, 4, 4, 4, 3, 4], [4, 4, 4, 4, 3, 4]);
    docsInsightsRetro($world, 42, [5, 4, 5, 4, 4, 4, 5], [4, 5, 5, 4, 3, 4]);

    $answersBySprint = [
        40 => [9, 9, 8, 7, 6, 5, 3],
        41 => [10, 9, 9, 8, 7, 6, 5],
        42 => [10, 9, 9, 9, 8, 7, 6],
    ];

    foreach ($answersBySprint as $number => $answers) {
        closedEnps($world->team, $answers, docsInsightsSprintStart($number)->addDays(11)->setTime(17, 0))
            ->update(['title' => "eNPS sprint {$number}", 'created_by_user_id' => $world->person('Camille')->id]);
    }
}

it('shows the team pulse, the ROTI of seven retros, the health check trend and the eNPS of three surveys', function () {
    $world = DocsWorld::create();
    $scope = [$world->workspace, $world->team];

    docsInsightsHistory($world);

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', $scope, false))
        ->assertPresent('#team-pulse [data-slot="team-pulse-roti"] [data-slot="roti-value"]')
        ->assertPresent('#team-pulse [data-slot="team-pulse-health"] [data-slot="roti-value"]')
        ->assertPresent('#team-pulse [data-slot="team-pulse-enps"] [data-slot="enps-value"]');

    $this->docShot($page, 'insights/team-pulse', '#team-pulse');

    $page->navigate(route('teams.insights.show', $scope, false))
        ->assertPresent('[data-slot="insights-tabs"]')
        ->assertCount('[data-slot="roti-trend-point"]', 7)
        ->assertSeeIn('[data-slot="roti-trend-delta"]', 'since S36')
        ->assertCount('[data-slot="retro-roti-list"] li', 7)
        ->assertNotPresent('main .animate-pulse');

    $this->docShot($page, 'insights/insights', 'main');
    $this->docShot($page, 'insights/roti-trend', '[data-slot="roti-trend"]');

    $page->navigate(route('teams.healthCheck.show', $scope, false))
        ->assertPresent('[data-slot="team-health-check"] a:has-text("Edit the statements")')
        ->assertCount('[data-slot="mood-trend-point"]', 7)
        ->assertPresent('[data-slot="mood-trend-band"]')
        ->assertNotPresent('[data-slot="team-health-check"] .animate-pulse');

    $this->docShot($page, 'insights/health-check', '[data-slot="team-health-check"]');

    $page->navigate(route('teams.enps.show', $scope, false))
        ->assertSeeIn('[data-slot="enps-score"]', '+43')
        ->assertCount('[data-slot="enps-line"]', 3);

    $this->docShot($page, 'insights/enps', '[data-slot="team-enps"]');
});

it('shows the health check statements of a team with one of its own and one disabled', function () {
    $world = DocsWorld::create();
    $statements = resolve(ManageTeamHealthStatements::class);

    $statements->add($world->team, 'I had enough uninterrupted time to focus', 'Focus time');
    $statements->archive($world->team, HealthStatement::ManagerSupport->value);

    $page = $this->docsVisit($world->person('Camille'), route('teams.healthStatements.index', [$world->workspace, $world->team], false))
        ->assertCount('[data-slot="health-statements-active"] [data-slot="health-statement"]', 6)
        ->assertSeeIn('[data-slot="health-statements-active"]', 'Focus time')
        ->assertSeeIn('[data-slot="health-archived-trigger"]', 'Disabled (1)')
        ->click('[data-slot="health-archived-trigger"]')
        ->assertSeeIn('[data-slot="health-statements-archived"]', 'Enable')
        ->hover('[data-slot="health-statements"] h2');

    $this->docShot($page, 'insights/health-statements', '[data-slot="health-statements"]');
});

it('shows the activity of a team over four days, by day', function () {
    $world = DocsWorld::create();
    $today = CarbonImmutable::today();
    $lastRetro = docsInsightsSprintStart(42)->addDays(10);

    $lines = [
        [TeamActivityKind::ActionItemCompleted, 'Malik', 'Add an alert on failed captures', $today->setTime(7, 40)],
        [TeamActivityKind::PokerStarted, 'Inès', 'Sprint 44 refinement', $today->setTime(7, 5)],
        [TeamActivityKind::WhiteboardCreated, 'Camille', 'Checkout journey map', $today->setTime(6, 30)],
        [TeamActivityKind::SurveyPublished, 'Camille', 'Team pulse sprint 43', $today->subDay()->setTime(14, 20)],
        [TeamActivityKind::ActionItemCompleted, 'Sofia', 'Write the payment retry runbook', $today->subDay()->setTime(12, 10)],
        [TeamActivityKind::MemberJoined, 'Lucas', null, $today->subDay()->setTime(8, 0)],
        [TeamActivityKind::SurveyClosed, 'Camille', 'eNPS sprint 42', $lastRetro->addDay()->setTime(15, 0)],
        [TeamActivityKind::PokerEnded, 'Inès', 'Sprint 43 refinement', $lastRetro->addDay()->setTime(9, 45)],
        [TeamActivityKind::RetroCompleted, 'Théo', 'Sprint 42 retro', $lastRetro->setTime(13, 0)],
        [TeamActivityKind::RetroStarted, 'Théo', 'Sprint 42 retro', $lastRetro->setTime(12, 0)],
    ];

    foreach ($lines as [$kind, $firstName, $subject, $at]) {
        TeamActivity::factory()->for($world->team)->create([
            'kind' => $kind,
            'actor_user_id' => $world->person($firstName)->id,
            'subject_title' => $subject,
            'created_at' => $at,
        ]);
    }

    $page = $this->docsVisit($world->person('Camille'), route('teams.activity.index', [$world->workspace, $world->team], false))
        ->assertCount('[data-slot="activity-page"] [data-test="activity-line"]', 10)
        ->assertSeeIn('[data-slot="load-more-end"]', '10 events')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'insights/activity', '[data-slot="activity-page"]');
});

it('shows Data & export in the team settings with two closed surveys to download', function () {
    $world = DocsWorld::create();
    $camille = $world->person('Camille');

    TeamSurvey::factory()->for($world->team)->closed()->withoutThreshold()->create(['title' => 'Team pulse sprint 42', 'created_by_user_id' => $camille->id, 'closed_at' => docsInsightsSprintStart(42)->addDays(11)->setTime(17, 0)]);
    TeamSurvey::factory()->for($world->team)->closed()->withoutThreshold()->create(['title' => 'eNPS sprint 41', 'created_by_user_id' => $camille->id, 'closed_at' => docsInsightsSprintStart(41)->addDays(11)->setTime(17, 0)]);

    $page = $this->docsVisit($camille, route('teams.data.show', [$world->workspace, $world->team], false))
        ->assertCount('[data-test="survey-export"]', 2)
        ->assertPresent('[data-test="action-items-link"]');

    $this->docShot($page, 'insights/data', '[data-slot="team-settings-shell"]');
});
