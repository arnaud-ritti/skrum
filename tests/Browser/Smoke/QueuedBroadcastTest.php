<?php

use App\Models\PokerGame;
use Illuminate\Support\Facades\DB;

it('delivers a broadcast made by a queued job to every open page', function () {
    config(['queue.default' => 'database']);

    $game = PokerGame::factory()->create(['auto_reveal' => true]);
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $facilitator->update(['name' => 'Ada', 'locale' => 'en']);
    $member->update(['name' => 'Bob', 'locale' => 'en']);
    openPokerRound($game);

    $facilitatorPage = $this->awaitRealtime($this->signIn($facilitator, "/poker/{$game->id}"));
    $memberPage = $this->awaitRealtime($this->signIn($member, "/poker/{$game->id}"));

    foreach ([$facilitatorPage, $memberPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $facilitatorPage->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min');

    foreach ([$facilitatorPage, $memberPage] as $page) {
        $page->assertSeeIn('[role="timer"]', '0:');
    }

    $memberPage->click('button[aria-label="Play 8"]');
    $facilitatorPage->assertPresent('[role="img"][aria-label="Bob: Voted"]');

    expect(DB::table('jobs')->count())->toBe(1);

    $this->travel(61)->seconds();
    $this->workQueue();

    foreach ([$facilitatorPage, $memberPage] as $page) {
        $page->assertSee("Revealed automatically — time's up");
    }

    expect(DB::table('jobs')->count())->toBe(0);
});
