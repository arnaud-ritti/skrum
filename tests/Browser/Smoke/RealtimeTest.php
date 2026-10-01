<?php

use App\Models\PokerGame;
use App\Models\PokerTask;

it('shows one member a task another member adds, without a reload', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $facilitator->update(['locale' => 'en']);
    $member->update(['locale' => 'en']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Existing story']);

    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/poker/{$game->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/poker/{$game->id}"));

    $facilitatorPage->click('Add task')
        ->fill('#poker-task-title', 'Realtime smoke story')
        ->click('Save');

    $memberPage->assertSee('Realtime smoke story');
});
