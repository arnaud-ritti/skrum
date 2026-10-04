<?php

use App\Enums\IntegrationProvider;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use Inertia\Testing\AssertableInertia as Assert;

it('keeps today behaviour on a game created without the new options', function () {
    $game = PokerGame::factory()->create()->fresh();

    expect($game->revote_after_reveal)->toBeFalse()
        ->and($game->task_timer_seconds)->toBeNull()
        ->and($game->writes_estimates)->toBeTrue()
        ->and($game->estimate_field_id)->toBeNull();
});

it('stores the poker options with their types', function () {
    $game = PokerGame::factory()->create([
        'revote_after_reveal' => true,
        'task_timer_seconds' => 180,
        'writes_estimates' => false,
        'estimate_field_id' => 'customfield_10016',
    ])->fresh();

    expect($game->revote_after_reveal)->toBeTrue()
        ->and($game->task_timer_seconds)->toBe(180)
        ->and($game->writes_estimates)->toBeFalse()
        ->and($game->estimate_field_id)->toBe('customfield_10016')
        ->and(PokerGame::TaskTimerChoices)->toBe([60, 180, 300, 600]);
});

it('stores phase durations as an object of minutes, null by default', function () {
    $retro = Retro::factory()->create();

    expect($retro->fresh()->phase_durations)->toBeNull();

    $retro->update(['phase_durations' => ['writing' => 7, 'voting' => 3]]);

    expect($retro->fresh()->phase_durations)->toBeIgnoringKeyOrder(['writing' => 7, 'voting' => 3]);
});

it('keeps ticket details out of mass assignment', function () {
    $task = PokerTask::factory()->create();

    $task->fill(['external_type' => 'Story', 'external_labels' => ['ui']])->save();

    expect($task->fresh()->only(['external_type', 'external_labels']))
        ->toBe(['external_type' => null, 'external_labels' => null]);

    $task->forceFill(['external_type' => 'Story', 'external_labels' => ['ui', 'api']])->save();

    expect($task->fresh()->external_labels)->toBe(['ui', 'api'])
        ->and($task->fresh()->external_type)->toBe('Story');
});

it('creates a game with the three options and a field of the team connection', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), [
            'title' => 'Sprint 44 refinement', 'deck' => 'fibonacci',
            'revote_after_reveal' => true, 'task_timer_seconds' => 180, 'writes_estimates' => true, 'estimate_field_id' => 'customfield_10016',
        ])
        ->assertSessionHasNoErrors();

    expect(PokerGame::query()->sole()->only(['revote_after_reveal', 'task_timer_seconds', 'writes_estimates', 'estimate_field_id']))
        ->toBe(['revote_after_reveal' => true, 'task_timer_seconds' => 180, 'writes_estimates' => true, 'estimate_field_id' => 'customfield_10016']);
});

it('refuses a timer outside the list and a field the connection does not have', function (array $payload, string $error) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.pokerGames.store', [$team->workspace, $team]), ['title' => 'P', 'deck' => 'fibonacci', ...$payload])
        ->assertSessionHasErrors($error);
})->with([
    'two minutes' => [['task_timer_seconds' => 120], 'task_timer_seconds'],
    'unknown field' => [['estimate_field_id' => 'customfield_1'], 'estimate_field_id'],
]);

it('lets the facilitator change the options in the room', function () {
    $table = pokerRevealTable();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $table['game']), ['revote_after_reveal' => true, 'task_timer_seconds' => 300, 'writes_estimates' => false])
        ->assertNoContent();

    $this->actingAs($table['member'])
        ->getJson(route('poker.snapshot.show', $table['game']))
        ->assertJsonPath('game.revoteAfterReveal', true)
        ->assertJsonPath('game.taskTimerSeconds', 300)
        ->assertJsonPath('game.writesEstimates', false)
        ->assertJsonPath('game.estimateFieldId', null);

    $this->actingAs($table['member'])
        ->patchJson(route('poker.settings.update', $table['game']), ['revote_after_reveal' => false])
        ->assertForbidden();
});

it('gives the dialog the tracker sources and their fields', function () {
    enableIntegrations(IntegrationProvider::Jira);
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('pokerSources.0.source', 'jira')
            ->where('pokerSources.0.estimateFields.0.id', 'customfield_10016')
            ->where('pokerSources.0.defaultEstimateFieldId', 'customfield_10016'));
});

it('refuses in the room a timer outside the list and a field the connection does not have', function (array $payload, string $error) {
    $table = pokerRevealTable();

    $this->actingAs($table['facilitator'])
        ->patchJson(route('poker.settings.update', $table['game']), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($error);

    expect($table['game']->fresh()->only(['task_timer_seconds', 'estimate_field_id']))
        ->toBe(['task_timer_seconds' => null, 'estimate_field_id' => null]);
})->with([
    'two minutes' => [['task_timer_seconds' => 120], 'task_timer_seconds'],
    'unknown field' => [['estimate_field_id' => 'customfield_1'], 'estimate_field_id'],
    'not a boolean' => [['revote_after_reveal' => 'often'], 'revote_after_reveal'],
]);

it('refuses the room options to a guest', function () {
    $table = pokerRevealTable();
    $guest = pokerGuest($table['game']);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->patchJson(route('poker.settings.update', $table['game']), ['revote_after_reveal' => true, 'task_timer_seconds' => 60])
        ->assertForbidden();

    expect($table['game']->fresh()->only(['revote_after_reveal', 'task_timer_seconds']))
        ->toBe(['revote_after_reveal' => false, 'task_timer_seconds' => null]);
});
