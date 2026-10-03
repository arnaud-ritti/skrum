<?php

use App\Support\Database\SearchText;
use App\Support\Surveys\ImportHealthChecks;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const HealthImportMigration = '2026_10_20_100100_copy_health_checks_to_team_surveys.php';

/** @param array<string, mixed> $values */
function rowBeforeHealthImport(string $table, array $values): string
{
    $id = (string) Str::uuid7();

    DB::table($table)->insert(['id' => $id, 'created_at' => '2026-09-01 09:00:00', 'updated_at' => '2026-09-01 09:00:00', ...$values]);

    return $id;
}

it('copies the health checks of an existing install into team surveys by running the migration itself', function () {
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < HealthImportMigration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $workspace = rowBeforeHealthImport('workspaces', ['name' => 'Acme', 'slug' => 'acme']);
    $team = rowBeforeHealthImport('teams', ['workspace_id' => $workspace, 'name' => 'Platform']);
    $ada = rowBeforeHealthImport('users', ['name' => 'Ada', 'email' => 'ada@example.test', 'email_key' => 'ada@example.test', 'name_search' => SearchText::fold('Ada'), 'password' => 'secret']);
    $retro = fn (string $title, string $phase, ?string $completedAt): string => rowBeforeHealthImport('retros', [
        'team_id' => $team,
        'title' => $title,
        'title_search' => SearchText::fold($title),
        'template' => 'start_stop_continue',
        'guest_token' => Str::random(40),
        'phase' => $phase,
        'health_check_enabled' => true,
        'completed_at' => $completedAt,
    ]);
    $closed = $retro('Sprint 41', 'completed', '2026-09-10 10:00:00');
    $open = $retro('Sprint 42', 'health_check', null);
    $member = rowBeforeHealthImport('participants', ['retro_id' => $closed, 'user_id' => $ada]);
    $guest = rowBeforeHealthImport('participants', ['retro_id' => $closed, 'guest_name' => 'Gus']);
    $custom = (string) Str::uuid7();

    foreach ([[$closed, 'vision', 'vision', null, null], [$closed, $custom, null, 'We ship without fear', 'Shipping'], [$open, 'vision', 'vision', null, null]] as $position => [$retroId, $key, $builtin, $text, $label]) {
        rowBeforeHealthImport('retro_health_statements', ['retro_id' => $retroId, 'key' => $key, 'builtin' => $builtin, 'text' => $text, 'label' => $label, 'position' => $position]);
    }

    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $member, 'statement' => 'vision', 'score' => 8]);
    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $member, 'statement' => $custom, 'score' => 3]);
    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $guest, 'statement' => 'vision', 'score' => 10]);
    rowBeforeHealthImport('health_check_answers', ['retro_id' => $closed, 'participant_id' => $guest, 'statement' => 'motivation', 'score' => 1]);

    $oldAnswers = DB::table('health_check_answers')->orderBy('id')->get()->toArray();

    Artisan::call('migrate', ['--path' => [database_path('migrations/'.HealthImportMigration)], '--realpath' => true]);

    $closedSurvey = DB::table('team_surveys')->where('retro_id', $closed)->sole();
    $openSurvey = DB::table('team_surveys')->where('retro_id', $open)->sole();
    $values = DB::table('team_survey_answers')
        ->whereIn('team_survey_question_id', DB::table('team_survey_questions')->where('team_survey_id', $closedSurvey->id)->select('id'))
        ->pluck('value')
        ->map(fn (mixed $value): int => (int) $value)
        ->sort()
        ->values()
        ->all();

    expect($closedSurvey->status)->toBe('closed')
        ->and($openSurvey->status)->toBe('open')
        ->and($values)->toBe([3, 8, 10])
        ->and(DB::table('team_survey_questions')->where('team_survey_id', $closedSurvey->id)->pluck('scale_max')->map(fn (mixed $max): int => (int) $max)->unique()->values()->all())->toBe([10])
        ->and(DB::table('team_survey_questions')->where('team_survey_id', $openSurvey->id)->pluck('scale_max')->map(fn (mixed $max): int => (int) $max)->unique()->values()->all())->toBe([5])
        ->and(DB::table('team_survey_respondents')->where('team_survey_id', $closedSurvey->id)->whereNotNull('completed_at')->count())->toBe(1)
        ->and(DB::table('health_check_answers')->orderBy('id')->get()->toArray())->toEqual($oldAnswers)
        ->and(resolve(ImportHealthChecks::class)->handle())->toMatchArray(['surveys' => 0, 'questions' => 0, 'respondents' => 0, 'answers' => 0]);
});
