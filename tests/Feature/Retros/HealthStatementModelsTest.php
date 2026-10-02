<?php

use App\Enums\HealthStatement;
use App\Exceptions\ModelInvariantViolation;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use Illuminate\Database\QueryException;

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

it('orders team and retro statements by position', function () {
    $team = Team::factory()->create();
    TeamHealthStatement::factory()->for($team)->create(['position' => 1, 'label' => 'Second']);
    TeamHealthStatement::factory()->for($team)->create(['position' => 0, 'label' => 'First']);

    $retro = Retro::factory()->create();
    RetroHealthStatement::factory()->for($retro)->builtin(HealthStatement::Vision)->create(['position' => 1]);
    RetroHealthStatement::factory()->for($retro)->builtin(HealthStatement::Motivation)->create(['position' => 0]);

    expect($team->healthStatements()->pluck('label')->all())->toBe(['First', 'Second'])
        ->and($retro->healthStatements()->pluck('key')->all())->toBe(['motivation', 'vision']);
});

it('stores one answer per participant and statement', function () {
    $answer = HealthCheckAnswer::factory()->create(['statement' => 'vision', 'score' => 7]);

    expect($answer->retro->healthCheckAnswers()->sole()->score)->toBe(7);

    HealthCheckAnswer::factory()->create([
        'retro_id' => $answer->retro_id,
        'participant_id' => $answer->participant_id,
        'statement' => 'vision',
    ]);
})->throws(QueryException::class);

it('refuses a built-in team statement that also has a text', function () {
    TeamHealthStatement::factory()->create(['builtin' => HealthStatement::Vision, 'text' => 'Reworded', 'label' => 'Vision']);
})->throws(ModelInvariantViolation::class);

it('removes a retro frozen set and its answers with the retro', function () {
    $retro = Retro::factory()->create();
    RetroHealthStatement::factory()->for($retro)->create();
    HealthCheckAnswer::factory()->create([
        'retro_id' => $retro->id,
        'participant_id' => Participant::factory()->create(['retro_id' => $retro->id])->id,
    ]);

    $retro->delete();

    expect(RetroHealthStatement::count())->toBe(0)->and(HealthCheckAnswer::count())->toBe(0);
});
