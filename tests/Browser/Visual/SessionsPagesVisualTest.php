<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;
use App\Models\TeamSurveyRespondent;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

/**
 * The Atlas team of the Nordlys workspace and its manager, Camille Roux.
 *
 * @return array{
 *     0: Workspace,
 *     1: Team,
 *     2: User
 * }
 */
function sessionsVisualSessionsTeam(): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199b022-0000-7000-8000-000000000001',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    return [$workspace, $team, $admin];
}

/**
 * Signs `$user` in, in the language of the capture, and opens `$path`.
 *
 * @param  array<string, string>  $options
 */
function sessionsVisualSessionsPage(User $user, string $path, array $options): mixed
{
    return visualSignIn($user, $path, $options)
        ->assertPresent('[data-slot="sessions-page"]');
}

/**
 * A poll of the team with `$answers` respondents who answered its one question.
 */
function sessionsVisualAnsweredPoll(TeamSurvey $survey, int $answers): void
{
    $question = TeamSurveyQuestion::factory()->create(['team_survey_id' => $survey->id]);

    foreach (range(1, $answers) as $index) {
        TeamSurveyAnswer::factory()->create([
            'team_survey_question_id' => $question->id,
            'team_survey_respondent_id' => TeamSurveyRespondent::factory()->create(['team_survey_id' => $survey->id])->id,
        ]);
    }
}

beforeEach(function () {
    config(['app.name' => 'Skrum']);

    RateLimiter::for('login', fn (): Limit => Limit::none());
});

it('renders the live sessions of the team, one of each kind, without overflow', function () {
    [$workspace, $team, $admin] = sessionsVisualSessionsTeam();
    $now = now();

    $this->travelTo($now->copy()->subMinutes(10));
    $room = GameRoom::factory()->for($team)->create(['name' => 'Icebreaker du vendredi']);
    activeGameRound($room);

    $this->travelTo($now->copy()->subMinutes(8));
    $poll = TeamSurvey::factory()->for($team)->open()->create(['title' => 'Team health · October']);
    sessionsVisualAnsweredPoll($poll, 7);

    $this->travelTo($now->copy()->subMinutes(6));
    $board = Whiteboard::factory()->for($team)->create(['title' => 'Q4 architecture']);
    $ines = User::factory()->create(['name' => 'Inès Benali']);
    $board->forceFill(['facilitator_member_id' => WhiteboardMember::factory()->create(['whiteboard_id' => $board->id, 'user_id' => $ines->id])->id])->save();
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id]);

    $this->travelTo($now->copy()->subMinutes(4));
    $game = PokerGame::factory()->for($team)->create(['title' => 'Sprint 43 refinement']);
    $tasks = PokerTask::factory()->count(12)->create(['poker_game_id' => $game->id]);
    openPokerRound($game, $tasks->first());

    $this->travelTo($now->copy()->subMinutes(2));
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->started()->create(['title' => 'Sprint 42 retro']);
    Participant::factory()->count(9)->create(['retro_id' => $retro->id]);

    $this->travelBack();

    $this->captureVisuals(
        'sessions-live',
        route('teams.sessions.index', [$workspace, $team], false),
        fn (string $path, array $options) => sessionsVisualSessionsPage($admin, $path, $options)
            ->assertCount('[data-slot="sessions-page"] > section [data-slot="session-row"]', 5)
            ->assertSeeIn('[data-slot="sessions-page"] > section [data-slot="card"]:first-of-type', 'Sprint 42 retro')
            ->assertCount('[data-slot="sessions-page"] nav a[aria-current="page"]', 1)
            ->assertPresent('[data-slot="load-more-end"]'),
    );
});

it('renders the finished sessions of the team with more to load without overflow', function () {
    [$workspace, $team, $admin] = sessionsVisualSessionsTeam();
    $now = now();

    foreach (range(1, 25) as $index) {
        $sprint = 41 - intdiv($index - 1, 5);

        $this->travelTo($now->copy()->subDays($index)->setTime(16, 30));

        match ($index % 5) {
            1 => Participant::factory()->count(6 + $index % 4)->create([
                'retro_id' => Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->started()->create([
                    'title' => "Sprint {$sprint} retro",
                    'completed_at' => now(),
                ])->id,
            ]),
            2 => PokerTask::factory()->count(5 + $index % 7)->create([
                'poker_game_id' => PokerGame::factory()->for($team)->ended()->create(['title' => "Sprint {$sprint} refinement"])->id,
            ]),
            3 => sessionsVisualAnsweredPoll(TeamSurvey::factory()->for($team)->closed()->create(['title' => "Team health · sprint {$sprint}"]), 4 + intdiv($index, 5)),
            4 => WhiteboardElement::factory()->create([
                'whiteboard_id' => Whiteboard::factory()->for($team)->create(['title' => "Sprint {$sprint} planning board"])->id,
            ]),
            default => tap(GameRoom::factory()->for($team)->createOne(['name' => "Sprint {$sprint} icebreaker"]), function (GameRoom $room): void {
                activeGameRound($room);
                $room->forceFill(['current_round_id' => null])->save();
            }),
        };
    }

    $this->travelBack();

    $this->captureVisuals(
        'sessions-finished',
        route('teams.sessions.index', [$workspace, $team, 'tab' => 'finished'], false),
        fn (string $path, array $options) => sessionsVisualSessionsPage($admin, $path, $options)
            ->assertCount('[data-slot="session-row"]', 20)
            ->assertPresent('[data-slot="load-more"]')
            ->assertPresent('[data-slot="load-more"] [data-slot="badge"]:text-matches("^5 ")'),
    );
});
