<?php

use App\Models\PokerGame;
use App\Models\PokerTask;

it('reorders poker tasks with the keyboard and keeps the new order', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $facilitator->update(['locale' => 'en']);
    $member->update(['locale' => 'en']);

    foreach (['Alpha story', 'Bravo story', 'Charlie story'] as $title) {
        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => $title]);
    }

    $positionOfAlpha = 'Array.from(document.querySelectorAll("ol li")).findIndex((row) => row.textContent.includes("Alpha story"))';
    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/poker/{$game->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/poker/{$game->id}"));
    $facilitatorPage->assertScript($positionOfAlpha, 0);

    $this->dragWithKeyboard(
        $facilitatorPage,
        'li:has-text("Alpha story") [aria-label="Drag to reorder"]',
        ['Space', 'ArrowDown', 'Space'],
    );

    $memberPage->assertScript($positionOfAlpha, 1);
    $facilitatorPage->navigate("/poker/{$game->id}")->assertScript($positionOfAlpha, 1);
});
