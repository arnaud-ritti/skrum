<?php

use App\Actions\Retros\DeleteCard;
use App\Actions\Retros\UpdateCard;
use App\Enums\RetroPhase;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardUpdated;
use App\Events\Retros\OwnCardSaved;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

beforeEach(function () {
    Event::fake();
});

it('updates an own card and broadcasts it like the board endpoint', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Old']);

    $updated = app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'New']);

    expect($updated->content)->toBe('New')
        ->and($updated->relationLoaded('retro'))->toBeTrue()
        ->and($card->fresh()->content)->toBe('New');

    Event::assertDispatched(CardUpdated::class);
    Event::assertDispatched(OwnCardSaved::class);
});

it('keeps fields that are not in the changes', function () {
    $retro = Retro::factory()->create(['gifs_enabled' => true]);
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Keep', 'gif_id' => 'abc']);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Changed']);

    expect($card->fresh()->gif_id)->toBe('abc');
});

it('refuses to update another participant\'s card', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Mine now']);
})->throws(AuthorizationException::class, 'You can only change your own cards.');

it('refuses to update a card outside Writing and Grouping', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Late']);
})->throws(AuthorizationException::class, 'This action is not available in the current phase.');

it('refuses to update a card on a locked board', function () {
    $retro = Retro::factory()->create(['is_locked' => true]);
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => 'Locked']);
})->throws(HttpException::class, 'The board is closed for editing.');

it('refuses to empty a card without a GIF', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);

    app(UpdateCard::class)->handle($retro, $card, $participant, ['content' => null]);
})->throws(ValidationException::class);

it('deletes an own card and ungroups its children', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $participant] = retroMember($retro);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $lead->column_id, 'parent_card_id' => $lead->id]);

    app(DeleteCard::class)->handle($retro, $lead, $participant);

    expect(Card::query()->whereKey($lead->id)->exists())->toBeFalse()
        ->and($child->fresh()->parent_card_id)->toBeNull();

    Event::assertDispatched(CardDeleted::class, fn (CardDeleted $event) => $event->cardId === $lead->id);
});

it('refuses to delete another participant\'s card', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    app(DeleteCard::class)->handle($retro, $card, $participant);
})->throws(AuthorizationException::class, 'You can only change your own cards.');
