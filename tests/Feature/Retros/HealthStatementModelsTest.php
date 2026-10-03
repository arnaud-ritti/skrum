<?php

use App\Enums\HealthStatement;
use App\Exceptions\ModelInvariantViolation;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\TeamSurvey;
use App\Models\TeamSurveyAnswer;
use App\Models\TeamSurveyQuestion;

it('lists the six built-in statements in their default order with translated texts and labels', function () {
    app()->setLocale('fr');

    expect(array_map(fn (HealthStatement $statement) => $statement->value, HealthStatement::cases()))->toBe([
        'interaction', 'task_clarity', 'manager_support', 'vision', 'processes', 'motivation',
    ])
        ->and(HealthStatement::TaskClarity->text())->toBe('Les tâches qui m’ont été confiées étaient claires')
        ->and(HealthStatement::TaskClarity->label())->toBe('Tâches claires');
});

it('keys built-in team statements by their value and custom ones by their id', function () {
    $builtin = TeamHealthStatement::factory()->builtin(HealthStatement::Vision)->create();
    $custom = TeamHealthStatement::factory()->create(['text' => 'We shipped on time', 'label' => 'Delivery']);

    expect($builtin->key())->toBe('vision')
        ->and($builtin->isBuiltin())->toBeTrue()
        ->and($custom->key())->toBe($custom->id)
        ->and($custom->isBuiltin())->toBeFalse()
        ->and($custom->isArchived())->toBeFalse()
        ->and(TeamHealthStatement::factory()->archived()->create()->isArchived())->toBeTrue();
});

it('orders team statements by position', function () {
    $team = Team::factory()->create();
    TeamHealthStatement::factory()->for($team)->create(['position' => 1, 'label' => 'Second']);
    TeamHealthStatement::factory()->for($team)->create(['position' => 0, 'label' => 'First']);

    expect($team->healthStatements()->pluck('label')->all())->toBe(['First', 'Second']);
});

it('refuses a built-in team statement that also has a text', function () {
    TeamHealthStatement::factory()->create(['builtin' => HealthStatement::Vision, 'text' => 'Reworded', 'label' => 'Vision']);
})->throws(ModelInvariantViolation::class);

it('removes an attached health check and its answers with the retro', function () {
    $retro = Retro::factory()->withHealthCheck()->create();
    answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), [HealthStatement::Vision->value => 4]);

    $retro->delete();

    expect(TeamSurvey::count())->toBe(0)
        ->and(TeamSurveyQuestion::count())->toBe(0)
        ->and(TeamSurveyAnswer::count())->toBe(0);
});
