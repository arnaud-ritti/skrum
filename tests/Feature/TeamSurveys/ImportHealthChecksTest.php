<?php

use App\Models\Participant;
use App\Models\User;
use App\Support\Surveys\ImportHealthChecks;
use App\Support\Surveys\VerifyHealthCheckImport;
use Illuminate\Support\Facades\DB;

it('copies each health check into a survey attached to its retro, values and scale as given', function () {
    $history = healthHistory();

    $report = resolve(ImportHealthChecks::class)->handle();

    expect($report)->toBe(['surveys' => 5, 'questions' => 11, 'respondents' => 6, 'answers' => 10, 'skippedAnswers' => 1]);

    $survey = importedSurvey($history['sprint41']->id);

    expect($survey)
        ->team_id->toBe($history['team']->id)
        ->title->toBe('Sprint 41')
        ->status->toBe('closed')
        ->and((int) $survey->results_threshold)->toBe(0)
        ->and($survey->guest_access_enabled)->toBeFalsy()
        ->and($survey->one_question_at_a_time)->toBeFalsy()
        ->and($survey->show_results_after_answer)->toBeFalsy()
        ->and(strlen($survey->guest_token))->toBe(40)
        ->and(substr((string) $survey->closed_at, 0, 19))->toBe('2026-09-10 10:00:00')
        ->and(substr((string) $survey->opened_at, 0, 19))->toBe('2026-09-10 09:00:00');

    $questions = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->orderBy('position')->orderBy('id')->get();

    expect($questions->pluck('match_key')->all())->toBe(['interaction', 'vision', $history['custom']])
        ->and($questions->pluck('builtin')->all())->toBe(['interaction', 'vision', null])
        ->and($questions->pluck('kind')->unique()->values()->all())->toBe(['scale'])
        ->and($questions->map(fn (object $question): int => (int) $question->scale_max)->unique()->values()->all())->toBe([10])
        ->and($questions->map(fn (object $question): bool => (bool) $question->is_required)->unique()->values()->all())->toBe([true])
        ->and($questions[0]->label)->toBe('Interaction with colleagues was productive')
        ->and($questions[2]->label)->toBe('We ship without fear')
        ->and($questions[2]->short_label)->toBe('Shipping');
});

it('asks a health check nobody answered on the new scale of five', function () {
    $history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    $scales = fn (string $retroId): array => DB::table('team_survey_questions')
        ->where('team_survey_id', importedSurvey($retroId)->id)
        ->pluck('scale_max')
        ->map(fn (mixed $max): int => (int) $max)
        ->unique()
        ->values()
        ->all();

    expect($scales($history['openUnanswered']->id))->toBe([5])
        ->and($scales($history['inHealthPhase']->id))->toBe([10])
        ->and($scales($history['turnedOff']->id))->toBe([10]);
});

it('keeps who answered what, and stamps as sent only who answered every statement', function () {
    $history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    $survey = importedSurvey($history['sprint41']->id);
    $respondents = DB::table('team_survey_respondents')->where('team_survey_id', $survey->id)->get()->keyBy('participant_id');
    $questions = DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->pluck('id', 'match_key');
    $value = fn (string $participantId, string $key) => DB::table('team_survey_answers')
        ->where('team_survey_respondent_id', $respondents[$participantId]->id)
        ->where('team_survey_question_id', $questions[$key])
        ->value('value');

    expect($respondents)->toHaveCount(3)
        ->and($respondents[$history['aliceIn41']->id]->user_id)->toBe($history['alice']->id)
        ->and($respondents[$history['guest']->id]->guest_name)->toBe('Gus')
        ->and($respondents[$history['guest']->id]->guest_secret_hash)->toBeNull()
        ->and($respondents[$history['former']->id]->user_id)->toBeNull()
        ->and($respondents[$history['former']->id]->guest_name)->toBeNull()
        ->and($survey->facilitator_respondent_id)->toBe($respondents[$history['aliceIn41']->id]->id)
        ->and($survey->created_by_user_id)->toBe($history['alice']->id)
        ->and((int) $value($history['aliceIn41']->id, 'interaction'))->toBe(8)
        ->and((int) $value($history['aliceIn41']->id, $history['custom']))->toBe(4)
        ->and((int) $value($history['guest']->id, 'vision'))->toBe(10)
        ->and((int) $value($history['former']->id, 'interaction'))->toBe(7)
        ->and(substr((string) $respondents[$history['aliceIn41']->id]->completed_at, 0, 19))->toBe('2026-09-10 09:02:00')
        ->and($respondents[$history['guest']->id]->completed_at)->toBeNull()
        ->and($respondents[$history['former']->id]->completed_at)->toBeNull();
});

it('gives each retro the status its health check had', function () {
    $history = healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    expect(importedSurvey($history['sprint40']->id)->status)->toBe('closed')
        ->and(importedSurvey($history['inHealthPhase']->id)->status)->toBe('open')
        ->and(importedSurvey($history['openUnanswered']->id)->status)->toBe('open')
        ->and(importedSurvey($history['turnedOff']->id)->status)->toBe('draft')
        ->and(importedSurvey($history['completedUnanswered']->id))->toBeNull()
        ->and(importedSurvey($history['never']->id))->toBeNull();
});

it('gives answers a random id', function () {
    healthHistory();

    resolve(ImportHealthChecks::class)->handle();

    expect(DB::table('team_survey_answers')->pluck('id')->every(fn (string $id): bool => $id[14] === '4'))->toBeTrue();
});

it('changes nothing when it runs a second time', function () {
    healthHistory();
    $import = resolve(ImportHealthChecks::class);
    $import->handle();
    $counts = fn (): array => array_map(fn (string $table): int => DB::table($table)->count(), [
        'team_surveys', 'team_survey_questions', 'team_survey_respondents', 'team_survey_answers',
    ]);
    $before = $counts();

    expect($import->handle())->toBe(['surveys' => 0, 'questions' => 0, 'respondents' => 0, 'answers' => 0, 'skippedAnswers' => 1])
        ->and($counts())->toBe($before);
});

it('brings an answer written to the old tables after the first run, on the scale it was given', function () {
    $history = healthHistory();
    $import = resolve(ImportHealthChecks::class);
    $import->handle();

    $late = Participant::factory()->create(['retro_id' => $history['inHealthPhase']->id, 'user_id' => User::factory()]);
    oldHealthAnswer($history['inHealthPhase'], $late, 'vision', 9, '2026-10-01 09:30:00');
    $first = Participant::factory()->create(['retro_id' => $history['openUnanswered']->id, 'user_id' => User::factory()]);
    oldHealthAnswer($history['openUnanswered'], $first, 'vision', 7, '2026-10-01 09:40:00');

    expect($import->handle())->toMatchArray(['surveys' => 0, 'questions' => 0, 'respondents' => 2, 'answers' => 2])
        ->and(DB::table('team_survey_questions')->where('team_survey_id', importedSurvey($history['openUnanswered']->id)->id)->pluck('scale_max')->map(fn (mixed $max): int => (int) $max)->unique()->values()->all())->toBe([10]);
});

it('leaves behind an old answer to a question already answered on five, and the verification flags its retro', function () {
    $history = healthHistory();
    $import = resolve(ImportHealthChecks::class);
    $import->handle();
    $retro = $history['openUnanswered'];
    answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()]), ['interaction' => 4, 'vision' => 3]);
    oldHealthAnswer($retro, Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()]), 'vision', 9, '2026-10-01 09:40:00');

    expect($import->handle())->toMatchArray(['answers' => 0, 'skippedAnswers' => 2])
        ->and(DB::table('team_survey_answers')->whereIn('team_survey_question_id', DB::table('team_survey_questions')->where('team_survey_id', importedSurvey($retro->id)->id)->select('id'))->max('value'))->toBe(4)
        ->and(collect(resolve(VerifyHealthCheckImport::class)->handle())->pluck('retroId')->all())->toContain($retro->id);
});

it('leaves the old tables as they were', function () {
    healthHistory();
    $statements = DB::table('retro_health_statements')->orderBy('id')->get()->toArray();
    $answers = DB::table('health_check_answers')->orderBy('id')->get()->toArray();

    resolve(ImportHealthChecks::class)->handle();

    expect(DB::table('retro_health_statements')->orderBy('id')->get()->toArray())->toEqual($statements)
        ->and(DB::table('health_check_answers')->orderBy('id')->get()->toArray())->toEqual($answers);
});

it('verifies itself, and tells when a copied answer was altered', function () {
    $history = healthHistory();
    resolve(ImportHealthChecks::class)->handle();

    expect(resolve(VerifyHealthCheckImport::class)->handle())->toBeEmpty();
    $this->artisan('surveys:verify-health-import')->assertSuccessful();

    $survey = importedSurvey($history['sprint41']->id);
    DB::table('team_survey_answers')
        ->whereIn('team_survey_question_id', DB::table('team_survey_questions')->where('team_survey_id', $survey->id)->select('id'))
        ->where('value', 10)
        ->update(['value' => 1]);

    $differences = resolve(VerifyHealthCheckImport::class)->handle();

    expect($differences)->toHaveCount(1)
        ->and($differences[0])->toMatchArray(['retroId' => $history['sprint41']->id, 'oldAnswers' => 6, 'newAnswers' => 6, 'oldSum' => 41, 'newSum' => 32]);
    $this->artisan('surveys:verify-health-import')->assertFailed();
});

it('reports what the command imported', function () {
    healthHistory();

    $this->artisan('surveys:import-health-checks')
        ->expectsOutputToContain('Created 5 surveys')
        ->assertSuccessful();
});
