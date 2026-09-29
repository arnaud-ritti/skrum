<?php

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;

it('allows listed phases and refuses others with a translated message', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->make();

    RetroGuard::phase($retro, RetroPhase::Voting, RetroPhase::Discussing);

    expect(fn () => RetroGuard::phase($retro, RetroPhase::Writing))
        ->toThrow(AuthorizationException::class, 'This action is not available in the current phase.');
});

it('allows only the facilitator', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);

    RetroGuard::facilitator($retro->fresh(), $facilitator);

    expect(fn () => RetroGuard::facilitator($retro->fresh(), $member))
        ->toThrow(AuthorizationException::class, 'Only the facilitator can do this.');
});

it('allows only the author of a card', function () {
    $card = Card::factory()->create();
    $other = Participant::factory()->create(['retro_id' => $card->retro_id]);

    RetroGuard::author($card, $card->participant);

    expect(fn () => RetroGuard::author($card, $other))
        ->toThrow(AuthorizationException::class, 'You can only change your own cards.');
});
