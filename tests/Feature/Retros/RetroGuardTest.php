<?php

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

it('allows listed phases and refuses others with a translated message', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->make();

    RetroGuard::phase($retro, RetroPhase::Voting, RetroPhase::Discussing);

    expect(fn () => RetroGuard::phase($retro, RetroPhase::Writing))
        ->toThrow(AuthorizationException::class, 'This action is not available in the current phase.');
});

it('takes action items from discussing to the roti phase', function (RetroPhase $phase, bool $allowed) {
    $retro = Retro::factory()->inPhase($phase)->make();

    if ($allowed) {
        RetroGuard::takesActionItems($retro);
    }

    if (! $allowed) {
        expect(fn () => RetroGuard::takesActionItems($retro))
            ->toThrow(AuthorizationException::class, 'This action is not available in the current phase.');
    }

    expect($phase->takesActionItems())->toBe($allowed);
})->with([
    'voting' => [RetroPhase::Voting, false],
    'discussing' => [RetroPhase::Discussing, true],
    'actions' => [RetroPhase::Actions, true],
    'roti' => [RetroPhase::Roti, true],
    'completed' => [RetroPhase::Completed, false],
]);

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

it('refuses changes to a board closed for editing with a 423', function () {
    $retro = Retro::factory()->make(['is_locked' => false]);

    RetroGuard::unlocked($retro);

    $retro->is_locked = true;

    expect(fn () => RetroGuard::unlocked($retro))
        ->toThrow(fn (HttpException $exception) => expect($exception->getStatusCode())->toBe(423)
            ->and($exception->getMessage())->toBe('The board is closed for editing.'));
});

it('refuses reactions when they are turned off', function () {
    $retro = Retro::factory()->make(['reactions_enabled' => false]);

    expect(fn () => RetroGuard::reactionsEnabled($retro))
        ->toThrow(AuthorizationException::class, 'Reactions are turned off for this board.');
});

it('allows actions in every phase but completed', function () {
    $retro = Retro::factory()->make(['phase' => RetroPhase::HealthCheck]);

    RetroGuard::open($retro);

    $retro->phase = RetroPhase::Completed;

    expect(fn () => RetroGuard::open($retro))
        ->toThrow(AuthorizationException::class, 'This action is not available in the current phase.');
});
