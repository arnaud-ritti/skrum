<?php

use App\Actions\TeamSurveys\CreateTeamSurvey;
use App\Actions\TeamSurveys\NewTeamSurvey;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\RateLimiter;

/**
 * The team Atlas of eleven members. Ids are fixed: the avatars are drawn from them.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     admin: User,
 *     members: array<int, User>
 * }
 */
function p19SurveyTeam(): array
{
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199c000-0000-7000-8000-000000000021',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    $names = ['Théo Martin', 'Arnaud Ritti', 'Inès Benali', 'Malik Kone', 'Sofia Lindqvist', 'Noa Kim', 'Zoé Petit', 'Hugo Lefèvre', 'Léa Garnier', 'Yann Le Goff'];
    $members = [];

    foreach ($names as $index => $name) {
        $member = User::factory()->create([
            'id' => sprintf('0199c000-0000-7000-8000-0000000001%02d', $index),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
        $members[] = $member;
    }

    RateLimiter::for('login', fn (): Limit => Limit::none());

    return ['workspace' => $workspace, 'team' => $team, 'admin' => $admin, 'members' => $members];
}

/**
 * Created in French, as a French team would have it: the questions of a template are written in the language of their author.
 */
function p19CreateSurvey(Team $team, User $creator, string $title, TeamSurveyTemplate $template, int $daysAgo, bool $guests = false): TeamSurvey
{
    $locale = App::getLocale();
    App::setLocale('fr');
    test()->travelTo(now()->subDays($daysAgo));

    $survey = resolve(CreateTeamSurvey::class)->handle($team, $creator, new NewTeamSurvey($title, $template, $guests));

    test()->travelBack();
    App::setLocale($locale);

    return $survey;
}

function p19SurveyStatus(TeamSurvey $survey, TeamSurveyStatus $status, int $openedDaysAgo, ?int $closedDaysAgo = null): void
{
    $survey->update([
        'status' => $status,
        'opened_at' => now()->subDays($openedDaysAgo)->setTime(9, 30),
        'closed_at' => $closedDaysAgo === null ? null : now()->subDays($closedDaysAgo)->setTime(17, 0),
    ]);
}

function p19Respondent(TeamSurvey $survey, User $user, bool $completed = true): TeamSurveyRespondent
{
    $respondent = TeamSurveyRespondent::query()->firstOrCreate(['team_survey_id' => $survey->id, 'user_id' => $user->id]);
    $respondent->update(['completed_at' => $completed ? now() : null]);

    return $respondent;
}

/**
 * One row per respondent: workload (1 to 5), NPS, the ritual kept (an option), what slowed (options), a word (or nothing).
 *
 * @param  array<int, User>  $people
 * @param  array<int, array{0: int, 1: int, 2: int, 3: array<int, int>, 4: ?string}>  $rows
 */
function p19AnswerPulse(TeamSurvey $survey, array $people, array $rows): void
{
    $questions = $survey->questions()->orderBy('position')->get()->values();

    foreach ($rows as $index => [$workload, $nps, $ritual, $slowed, $word]) {
        $respondent = p19Respondent($survey, $people[$index]);

        answerSurveyQuestion($questions[0], $respondent, $workload);
        answerSurveyQuestion($questions[1], $respondent, $nps);
        answerSurveyQuestion($questions[2], $respondent, [$ritual]);
        answerSurveyQuestion($questions[3], $respondent, $slowed);

        if ($word !== null) {
            answerSurveyQuestion($questions[4], $respondent, $word);
        }
    }
}

/**
 * Two Team pulses closed, the last compared with the one before; one open to guests; a draft of each template; and a
 * Mood trend fed by two retros whose health check was imported on ten and by one health check run as a survey.
 *
 * @return array{
 *     workspace: Workspace,
 *     team: Team,
 *     admin: User,
 *     members: array<int, User>,
 *     previous: TeamSurvey,
 *     closed: TeamSurvey,
 *     open: TeamSurvey,
 *     draft: TeamSurvey,
 *     healthDraft: TeamSurvey
 * }
 */
function p19SurveyPages(): array
{
    ['workspace' => $workspace, 'team' => $team, 'admin' => $admin, 'members' => $members] = p19SurveyTeam();
    $people = [$admin, ...$members];

    $previous = p19CreateSurvey($team, $admin, 'Pulse d\'équipe · sprint 41', TeamSurveyTemplate::TeamPulse, 16);
    p19SurveyStatus($previous, TeamSurveyStatus::Closed, 16, 14);
    p19AnswerPulse($previous, $people, [
        [3, 8, 0, [0], 'Trop de réunions le jeudi.'],
        [3, 7, 1, [0], null],
        [2, 9, 0, [1, 3], 'La démo a mis tout le monde sous pression.'],
        [4, 6, 0, [2], null],
        [3, 7, 2, [0, 3], null],
        [3, 5, 0, [3], 'Des specs plus tôt, s\'il te plaît.'],
        [2, 8, 1, [0], null],
        [3, 9, 3, [1], null],
    ]);

    $closed = p19CreateSurvey($team, $admin, 'Pulse d\'équipe · sprint 42', TeamSurveyTemplate::TeamPulse, 2);
    $closed->update(['previous_survey_id' => $previous->id]);
    p19SurveyStatus($closed, TeamSurveyStatus::Closed, 2, 0);
    p19AnswerPulse($closed, $people, [
        [4, 9, 0, [0], 'Merci pour l\'entraide sur la release.'],
        [3, 10, 0, [0, 3], null],
        [4, 8, 1, [1], 'Le pairing du mardi, à garder.'],
        [5, 7, 2, [0, 2], null],
        [3, 9, 0, [3], 'Moins de réunions, plus de focus.'],
        [4, 6, 3, [0], null],
        [2, 10, 0, [2, 3], 'Environnement de test encore instable.'],
        [4, 9, 1, [4], null],
        [3, 8, 0, [0, 1], 'Bravo pour la démo client !'],
    ]);

    $open = p19CreateSurvey($team, $admin, 'Pulse d\'équipe · sprint 43', TeamSurveyTemplate::TeamPulse, 1, guests: true);
    $open->update(['guest_token' => 'visual-guest-token-of-the-survey-page-01']);
    p19SurveyStatus($open, TeamSurveyStatus::Open, 0);
    $opening = $open->questions()->orderBy('position')->first();
    answerSurveyQuestion($opening, p19Respondent($open, $members[0], completed: false), 4);

    foreach ([$admin, $members[1], $members[2], $members[3]] as $person) {
        answerSurveyQuestion($opening, p19Respondent($open, $person, completed: false), 3);
    }

    $draft = p19CreateSurvey($team, $admin, 'Pulse d\'équipe · sprint 44', TeamSurveyTemplate::TeamPulse, 0);
    $healthDraft = p19CreateSurvey($team, $admin, 'Bilan de santé · novembre', TeamSurveyTemplate::HealthCheck, 0);

    foreach ([[40, 'Sprint 39 retro', [[8, 7, 9, 6, 7, 8], [6, 7, 8, 5, 6, 7]]], [26, 'Sprint 40 retro', [[7, 8, 8, 7, 6, 9], [9, 8, 7, 6, 8, 8]]]] as [$daysAgo, $title, $scores]) {
        $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create([
            'title' => $title,
            'created_at' => now()->subDays($daysAgo)->setTime(10, 0),
            'completed_at' => now()->subDays($daysAgo)->setTime(11, 0),
        ]);

        foreach ($scores as $index => $row) {
            $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $people[$index]->id]);
            answerHealthCheck($retro, $participant, array_combine(['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'], $row), 10);
            RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4 - $index]);
        }

        closeHealthCheck($retro);
    }

    $healthCheck = p19CreateSurvey($team, $admin, 'Bilan de santé · octobre', TeamSurveyTemplate::HealthCheck, 9);
    p19SurveyStatus($healthCheck, TeamSurveyStatus::Closed, 9, 7);
    $statements = $healthCheck->questions()->get()->keyBy('match_key');

    foreach ([[4, 4, 5, 3, 3, 4], [3, 4, 4, 4, 3, 4], [5, 3, 4, 3, 2, 4], [4, 4, 5, 4, 3, 5]] as $index => $row) {
        $respondent = p19Respondent($healthCheck, $people[$index]);

        foreach (array_combine(['interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation'], $row) as $key => $score) {
            answerSurveyQuestion($statements[$key], $respondent, $score);
        }
    }

    return ['workspace' => $workspace, 'team' => $team, 'admin' => $admin, 'members' => $members, 'previous' => $previous, 'closed' => $closed, 'open' => $open, 'draft' => $draft, 'healthDraft' => $healthDraft];
}

/**
 * @param  array<string, string>  $options
 */
function p19SignedIn(User $user, string $path, array $options): mixed
{
    User::query()->whereKey($user->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate($path);
}

it('[P19-31-01] renders the builder of a Team pulse draft, its first question open, without overflow', function () {
    ['admin' => $admin, 'draft' => $draft] = p19SurveyPages();

    $this->captureVisuals(
        'survey-builder',
        route('surveys.edit', $draft, false),
        fn (string $path, array $options) => p19SignedIn($admin, $path, $options)
            ->assertPresent('[data-slot="survey-builder"]')
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected'),
    );
});

it('[P19-31-02] renders the builder of a health-check draft, its list locked, without overflow', function () {
    ['admin' => $admin, 'healthDraft' => $healthDraft] = p19SurveyPages();

    $this->captureVisuals(
        'survey-builder-health-check',
        route('surveys.edit', $healthDraft, false),
        fn (string $path, array $options) => p19SignedIn($admin, $path, $options)
            ->assertPresent('[data-slot="survey-builder"]')
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected'),
    );
});

it('[P19-31-03] renders the participant page on the NPS question of a Team pulse without overflow', function () {
    ['members' => $members, 'open' => $open] = p19SurveyPages();

    $this->captureVisuals(
        'survey-participant',
        route('surveys.show', $open, false),
        fn (string $path, array $options) => p19SignedIn($members[0], $path, $options)
            ->assertAttribute('[data-test="survey-step"]', 'data-step', '1')
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected'),
    );
});

it('[P19-31-04] renders the results of a closed Team pulse with nine respondents without overflow', function () {
    ['admin' => $admin, 'closed' => $closed] = p19SurveyPages();

    $this->captureVisuals(
        'survey-results',
        route('surveys.results.show', $closed, false),
        fn (string $path, array $options) => p19SignedIn($admin, $path, $options)
            ->assertCount('[data-slot="survey-results-grid"] [data-slot="survey-question"]', 5),
    );
});

it('[P19-31-05] renders the Compare tab against the previous Team pulse without overflow', function () {
    ['admin' => $admin, 'closed' => $closed] = p19SurveyPages();

    $this->captureVisuals(
        'survey-compare',
        route('surveys.results.show', ['teamSurvey' => $closed, 'tab' => 'compare'], false),
        fn (string $path, array $options) => p19SignedIn($admin, $path, $options)
            ->assertPresent('[data-slot="survey-compare-pairs"] [data-slot="survey-compare-pair"]'),
    );
});

it('[P19-31-06] renders the guest join page of an open survey without overflow', function () {
    p19SurveyPages();

    $this->captureVisuals(
        'survey-join',
        '/surveys/join/visual-guest-token-of-the-survey-page-01',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="guest-join"] #name')
            ->fill('#name', 'Nadia'),
    );
});

it('[P19-31-07] renders the Surveys block of the team page without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'admin' => $admin] = p19SurveyPages();

    $this->captureVisuals(
        'team-surveys',
        route('teams.show', [$workspace, $team], false).'#surveys',
        fn (string $path, array $options) => p19SignedIn($admin, $path, $options)
            ->assertPresent('[data-slot="team-surveys"] [data-test="survey-card"]')
            ->assertNotPresent('[data-slot="team-trend-loading"]')
            ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0),
    );
});

it('[P19-31-08] renders the health-check page with a Mood trend of imported retros and a health check run as a survey without overflow', function () {
    ['workspace' => $workspace, 'team' => $team, 'admin' => $admin] = p19SurveyPages();

    $this->captureVisuals(
        'team-health-check-page',
        route('teams.healthCheck.show', [$workspace, $team], false),
        fn (string $path, array $options) => p19SignedIn($admin, $path, $options)
            ->assertPresent('[data-slot="team-health-check"]')
            ->assertCount('[data-slot="mood-trend-point"]', 3),
    );
});
