<?php

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;

it('cascades deletes from game to votes', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerFacilitator($game);
    $round = openPokerRound($game);
    pokerVote($round, $player, '5');

    $game->delete();

    expect(PokerPlayer::query()->count())->toBe(0)
        ->and(PokerTask::query()->count())->toBe(0)
        ->and(PokerRound::query()->count())->toBe(0)
        ->and(PokerVote::query()->count())->toBe(0);
});

it('clears facilitator and current task when their rows go', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerFacilitator($game);
    $round = openPokerRound($game);

    $player->delete();
    $round->task->delete();

    expect($game->fresh()->facilitator_player_id)->toBeNull()
        ->and($game->fresh()->current_task_id)->toBeNull();
});

it('touches the game when a vote changes', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerMember($game);
    $round = openPokerRound($game);

    $this->travelTo(now()->addMinutes(10)->startOfSecond());

    $vote = pokerVote($round, $player, '3');

    expect($game->fresh()->updated_at->toDateTimeString())->toBe(now()->toDateTimeString());

    $this->travelTo(now()->addMinutes(5));

    $vote->delete();

    expect($game->fresh()->updated_at->toDateTimeString())->toBe(now()->toDateTimeString());
});

it('labels saved decks by name', function () {
    $saved = PokerGame::factory()->customCards(['1', '2', '3'])->create(['deck_name' => 'Team scale']);
    $builtIn = PokerGame::factory()->deck(PokerDeck::Tshirt)->create();

    expect($saved->deckLabel())->toBe('Team scale')
        ->and($builtIn->deckLabel())->toBe('T-shirt sizes')
        ->and($builtIn->isNumeric())->toBeFalse()
        ->and(PokerGame::factory()->create()->isNumeric())->toBeTrue();
});

it('finds the latest round of the current task and whether votes exist', function () {
    $game = PokerGame::factory()->create();
    [, $player] = pokerMember($game);
    $first = openPokerRound($game);

    expect($game->fresh()->hasVotes())->toBeFalse();

    $second = openPokerRound($game, $first->task);
    pokerVote($second, $player, '8');

    $fresh = $game->fresh();

    expect($second->number)->toBe(2)
        ->and($fresh->latestRoundOfCurrentTask()?->id)->toBe($second->id)
        ->and($fresh->hasVotes())->toBeTrue()
        ->and($fresh->rounds()->count())->toBe(2)
        ->and($fresh->isEnded())->toBeFalse()
        ->and($fresh->guest_token)->toHaveLength(40)
        ->and($fresh->toArray())->not->toHaveKey('guest_token');
});
