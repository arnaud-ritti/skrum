<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Retro;
use Tests\Concurrency\Support\Race;

it('stores one reaction per emoji when one participant sends two emoji three times each at once', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $uri = route('retros.cards.reactions.update', [$retro, $card], false);
    $contenders = [];

    foreach (['👍', '🎉', '👍', '🎉', '👍', '🎉'] as $emoji) {
        $contenders[] = static fn (): int => Race::request($userId, 'PUT', $uri, ['emoji' => $emoji]);
    }

    $outcomes = Race::run($contenders);
    $stored = CardReaction::query()->where('card_id', $card->id)->where('participant_id', $participant->id)->pluck('emoji')->sort()->values()->all();
    $expected = ['👍', '🎉'];
    sort($expected);

    expect(array_column($outcomes, 'value'))->each->toBe(200)
        ->and($stored)->toBe($expected);
});
