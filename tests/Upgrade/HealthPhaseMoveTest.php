<?php

use App\Support\Database\SearchText;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const HealthPhaseMoveMigration = '2026_10_20_100200_move_retros_out_of_the_health_check_phase.php';

/** @param array<string, mixed> $values */
function rowBeforeHealthPhaseMove(string $table, array $values): string
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => '2026-10-01 09:00:00', 'updated_at' => '2026-10-01 09:00:00', ...$values]);

    return $id;
}

it('moves the retros caught in the health-check phase on, with their answers, by running the migration itself', function () {
    migrateBefore(HealthPhaseMoveMigration);

    $workspace = rowBeforeHealthPhaseMove('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = rowBeforeHealthPhaseMove('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $user = rowBeforeHealthPhaseMove('users', ['name' => 'Ada', 'email' => 'ada@example.test', 'email_key' => 'ada@example.test', 'name_search' => SearchText::fold('Ada'), 'password' => 'secret']);
    $retro = fn (string $title, string $phase, bool $icebreaker): string => rowBeforeHealthPhaseMove('retros', [
        'team_id' => $team,
        'title' => $title,
        'title_search' => SearchText::fold($title),
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
        'phase' => $phase,
        'health_check_enabled' => true,
        'icebreaker_enabled' => $icebreaker,
    ]);
    $plain = $retro('Plain', 'health_check', false);
    $withIcebreaker = $retro('With icebreaker', 'health_check', true);
    $voting = $retro('Voting', 'voting', false);
    $participant = rowBeforeHealthPhaseMove('participants', ['retro_id' => $plain, 'user_id' => $user]);
    rowBeforeHealthPhaseMove('retro_health_statements', ['retro_id' => $plain, 'key' => 'vision', 'builtin' => 'vision', 'position' => 0]);
    rowBeforeHealthPhaseMove('health_check_answers', ['retro_id' => $plain, 'participant_id' => $participant, 'statement' => 'vision', 'score' => 7]);

    runMigration(HealthPhaseMoveMigration);

    $phases = DB::table('retros')->pluck('phase', 'id');
    $survey = DB::table('team_surveys')->where('retro_id', $plain)->sole();
    $question = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->sole();

    expect($phases[$plain])->toBe('writing')
        ->and($phases[$withIcebreaker])->toBe('icebreaker')
        ->and($phases[$voting])->toBe('voting')
        ->and($survey->status)->toBe('open')
        ->and((int) $question->scale_max)->toBe(10)
        ->and((int) DB::table('team_survey_answers')->where('team_survey_question_id', $question->id)->value('value'))->toBe(7)
        ->and(DB::table('health_check_answers')->count())->toBe(1);
});
