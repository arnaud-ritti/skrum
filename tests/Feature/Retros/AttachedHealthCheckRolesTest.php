<?php

use App\Enums\TeamRole;
use App\Enums\TeamSurveyStatus;
use App\Enums\WorkspaceRole;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;

/**
 * @return array<string, int>
 */
function rolesHealthScores(): array
{
    return ['interaction' => 3, 'task_clarity' => 4, 'manager_support' => 5, 'vision' => 4, 'processes' => 2, 'motivation' => 4];
}

it('refuses a member the removal of the health check', function () {
    $retro = Retro::factory()->create();
    retroFacilitator($retro);
    [$member] = retroMember($retro);
    $survey = attachHealthCheck($retro);

    $this->actingAs($member)->deleteJson(route('retros.healthCheck.destroy', $retro))->assertForbidden();

    expect(TeamSurvey::query()->find($survey->id))->not->toBeNull();
});

it('refuses a guest of the retro the adding, closing, reopening and removal of the health check, and takes their answers', function () {
    $retro = Retro::factory()->create();
    retroFacilitator($retro);
    $guest = retroGuest($retro);
    $survey = attachHealthCheck($retro);
    $asGuest = $this->withCookies(retroGuestCookie($guest))->withCredentials();

    $asGuest->postJson(route('retros.healthCheck.store', $retro))->assertForbidden();
    $asGuest->putJson(route('retros.healthCheck.closure.update', $retro))->assertForbidden();
    $asGuest->deleteJson(route('retros.healthCheck.closure.destroy', $retro))->assertForbidden();
    $asGuest->deleteJson(route('retros.healthCheck.destroy', $retro))->assertForbidden();
    $asGuest->postJson(route('retros.healthCheck.submission.store', $retro), ['scores' => rolesHealthScores()])->assertOk();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->hasAnswers())->toBeTrue();
});

it('refuses the health check answers of an observer of the team', function () {
    $retro = Retro::factory()->create();
    retroFacilitator($retro);
    $survey = attachHealthCheck($retro);
    $observer = teamMember($retro->team, TeamRole::Observer);

    $this->actingAs($observer)
        ->postJson(route('retros.healthCheck.submission.store', $retro), ['scores' => rolesHealthScores()])
        ->assertForbidden();

    expect($survey->hasAnswers())->toBeFalse();
});

it('refuses someone of another workspace the health check of a retro', function () {
    $retro = Retro::factory()->create();
    retroFacilitator($retro);
    $survey = attachHealthCheck($retro);
    $stranger = User::factory()->create();
    Workspace::factory()->create()->members()->attach($stranger, ['role' => WorkspaceRole::Admin->value]);

    $this->actingAs($stranger)
        ->postJson(route('retros.healthCheck.submission.store', $retro), ['scores' => rolesHealthScores()])
        ->assertForbidden();
    $this->actingAs($stranger)->putJson(route('retros.healthCheck.closure.update', $retro))->assertForbidden();

    expect($survey->fresh()->status)->toBe(TeamSurveyStatus::Open)
        ->and($survey->hasAnswers())->toBeFalse();
});
