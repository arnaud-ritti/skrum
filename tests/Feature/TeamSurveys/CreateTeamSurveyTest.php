<?php

use App\Enums\TeamSurveyStatus;
use App\Enums\TeamSurveyTemplate;
use App\Enums\WorkspaceRole;
use App\Models\TeamSurvey;
use App\Models\User;

it('creates a draft with its creator as facilitator and opens the builder', function () {
    [$team, $user] = teamAndMember();

    $response = $this->actingAs($user)->post(route('teams.surveys.store', [$team->workspace, $team]), ['title' => 'Team pulse — sprint 42']);

    $survey = TeamSurvey::query()->sole();

    $response->assertRedirect(route('surveys.edit', $survey));

    expect($survey->team_id)->toBe($team->id)
        ->and($survey->status)->toBe(TeamSurveyStatus::Draft)
        ->and($survey->template)->toBeNull()
        ->and($survey->results_threshold)->toBe(3)
        ->and($survey->created_by_user_id)->toBe($user->id)
        ->and($survey->facilitator->user_id)->toBe($user->id)
        ->and($survey->guest_token)->toHaveLength(40)
        ->and($survey->questions()->count())->toBe(0);
});

it('creates a health check with the team\'s statements', function () {
    [$team, $user] = teamAndMember();

    $this->actingAs($user)->post(route('teams.surveys.store', [$team->workspace, $team]), [
        'title' => 'Health check — October',
        'template' => 'health_check',
        'guest_access_enabled' => true,
    ])->assertRedirect();

    $survey = TeamSurvey::query()->sole();

    expect($survey->template)->toBe(TeamSurveyTemplate::HealthCheck)
        ->and($survey->guest_access_enabled)->toBeTrue()
        ->and($survey->questions()->count())->toBe(6)
        ->and($survey->questions()->first()->scale_max)->toBe(5)
        ->and($survey->questions()->first()->is_required)->toBeTrue();
});

it('refuses someone who cannot view the team', function () {
    [$team] = teamAndMember();
    $outsider = User::factory()->create();
    $team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->post(route('teams.surveys.store', [$team->workspace, $team]), ['title' => 'Nope'])->assertForbidden();
});

it('validates the title and the template', function (array $body, string $field) {
    [$team, $user] = teamAndMember();

    $this->actingAs($user)->postJson(route('teams.surveys.store', [$team->workspace, $team]), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'no title' => [['title' => ''], 'title'],
    'title too long' => [['title' => str_repeat('a', 121)], 'title'],
    'unknown template' => [['title' => 'T', 'template' => 'ranking'], 'template'],
    'guest flag not a boolean' => [['title' => 'T', 'guest_access_enabled' => 'maybe'], 'guest_access_enabled'],
]);
