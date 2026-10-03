<?php

use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;

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
