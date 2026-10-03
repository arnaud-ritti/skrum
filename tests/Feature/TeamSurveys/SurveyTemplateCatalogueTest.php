<?php

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\TeamSurveys\WriteSurveyQuestions;
use App\Enums\HealthStatement;
use App\Enums\TeamSurveyQuestionKind;
use App\Enums\TeamSurveyTemplate;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Support\Surveys\SurveyTemplateCatalogue;

it('gives a blank survey no question', function () {
    expect(resolve(SurveyTemplateCatalogue::class)->questions(null, Team::factory()->create()))->toBe([]);
});

it('turns the six built-in statements into required scale questions from 1 to 5', function () {
    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::HealthCheck, Team::factory()->create());

    expect($questions)->toHaveCount(6)
        ->and($questions[0]->kind)->toBe(TeamSurveyQuestionKind::Scale)
        ->and($questions[0]->scaleMax)->toBe(5)
        ->and($questions[0]->builtin)->toBe(HealthStatement::Interaction)
        ->and($questions[0]->matchKey)->toBe('interaction')
        ->and($questions[0]->isRequired)->toBeTrue()
        ->and($questions[0]->allowsComment)->toBeFalse()
        ->and($questions[0]->scaleMinLabel)->toBeNull()
        ->and($questions[0]->scaleMaxLabel)->toBeNull();
});

it('follows the statements the team customised: order, archived ones left out, custom ones keyed by their id', function () {
    $team = Team::factory()->create();
    $manage = resolve(ManageTeamHealthStatements::class);
    $custom = $manage->add($team, 'We ship without fear', 'Shipping');
    $manage->archive($team, HealthStatement::ManagerSupport->value);
    $manage->reorder($team, [$custom->id, 'interaction', 'task_clarity', 'vision', 'processes', 'motivation']);

    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::HealthCheck, $team);

    expect(array_map(fn ($question) => $question->matchKey, $questions))
        ->toBe([$custom->id, 'interaction', 'task_clarity', 'vision', 'processes', 'motivation'])
        ->and($questions[0]->label)->toBe('We ship without fear')
        ->and($questions[0]->shortLabel)->toBe('Shipping')
        ->and($questions[0]->builtin)->toBeNull();
});

it('gives the team pulse its five questions', function () {
    $questions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::TeamPulse, Team::factory()->create());

    expect(array_map(fn ($question) => $question->kind, $questions))->toBe([
        TeamSurveyQuestionKind::Scale,
        TeamSurveyQuestionKind::Nps,
        TeamSurveyQuestionKind::Single,
        TeamSurveyQuestionKind::Multiple,
        TeamSurveyQuestionKind::Text,
    ])
        ->and($questions[0]->scaleMax)->toBe(5)
        ->and($questions[0]->isRequired)->toBeTrue()
        ->and($questions[0]->allowsComment)->toBeTrue()
        ->and($questions[2]->options)->toHaveCount(4)
        ->and($questions[3]->options)->toHaveCount(5);
});

it('lists the templates of the creation dialog with their number of questions', function () {
    $options = resolve(SurveyTemplateCatalogue::class)->options(Team::factory()->create());

    expect(array_column($options, 'key'))->toBe([null, 'health_check', 'team_pulse'])
        ->and(array_column($options, 'questionCount'))->toBe([0, 6, 5]);
});

it('writes definitions as questions and options, replacing what was there', function () {
    $survey = TeamSurvey::factory()->create();
    surveyQuestion($survey);
    $definitions = resolve(SurveyTemplateCatalogue::class)->questions(TeamSurveyTemplate::TeamPulse, $survey->team);

    resolve(WriteSurveyQuestions::class)->handle($survey, $definitions);

    $questions = $survey->questions()->with('options')->get();

    expect($questions)->toHaveCount(5)
        ->and($questions->pluck('position')->all())->toBe([0, 1, 2, 3, 4])
        ->and($questions[2]->options->pluck('position')->all())->toBe([0, 1, 2, 3]);
});
