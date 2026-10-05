<?php

use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

it('lists the enabled phases in order, the icebreaker first when enabled, else writing', function (bool $icebreaker, array $expected) {
    $retro = Retro::factory()->make(['icebreaker_enabled' => $icebreaker]);

    expect(array_map(fn (RetroPhase $phase) => $phase->value, $retro->phases()))->toBe($expected)
        ->and($retro->firstPhase()->value)->toBe($expected[0]);
})->with([
    'without icebreaker' => [false, ['writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed']],
    'icebreaker' => [true, ['icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed']],
]);

it('moves only to neighbours among the enabled phases', function () {
    $retro = Retro::factory()->withIcebreaker()->make(['phase' => RetroPhase::Writing]);

    expect($retro->previousPhase())->toBe(RetroPhase::Icebreaker)
        ->and($retro->nextPhase())->toBe(RetroPhase::Grouping)
        ->and($retro->canMoveTo(RetroPhase::Icebreaker))->toBeTrue()
        ->and($retro->canMoveTo(RetroPhase::Grouping))->toBeTrue()
        ->and($retro->canMoveTo(RetroPhase::Voting))->toBeFalse()
        ->and($retro->canMoveTo(RetroPhase::Writing))->toBeFalse();

    $retro->icebreaker_enabled = false;

    expect($retro->previousPhase())->toBeNull();

    $retro->phase = RetroPhase::Completed;

    expect($retro->nextPhase())->toBeNull()
        ->and($retro->canMoveTo(RetroPhase::Roti))->toBeTrue()
        ->and($retro->canMoveTo(RetroPhase::Discussing))->toBeFalse();
});

it('knows which phases are open and which hide the cards of others', function () {
    $hiding = array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase) => $phase->hidesOthersCards()));
    $open = array_values(array_filter(RetroPhase::cases(), fn (RetroPhase $phase) => $phase->isOpen()));

    expect(array_map(fn (RetroPhase $phase) => $phase->value, $hiding))->toBe(['icebreaker', 'writing'])
        ->and($open)->not->toContain(RetroPhase::Completed)
        ->and($open)->toHaveCount(7);
});

it('names members, guests and former members', function () {
    $member = Participant::factory()->create();
    $guest = Participant::factory()->guest()->create(['guest_name' => 'Visitor']);
    $former = Participant::factory()->create();
    $former->user->delete();

    expect($member->displayName())->toBe($member->user->name)
        ->and($member->isGuest())->toBeFalse()
        ->and($guest->displayName())->toBe('Visitor')
        ->and($guest->isGuest())->toBeTrue()
        ->and($former->fresh()->displayName())->toBe('Former member');
});

it('keeps cards of a deleted user', function () {
    $card = Card::factory()->create();

    $card->participant->user->delete();

    expect($card->fresh())->not->toBeNull();
});

it('knows its facilitator', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);

    expect($retro->fresh()->isFacilitator($facilitator))->toBeTrue()
        ->and($retro->fresh()->isFacilitator($member))->toBeFalse();
});

it('builds cards inside one retro', function () {
    $card = Card::factory()->create();

    expect($card->column->retro_id)->toBe($card->retro_id)
        ->and($card->participant->retro_id)->toBe($card->retro_id)
        ->and($card->isTopLevel())->toBeTrue();
});

it('reads the participant the middleware resolved', function () {
    $participant = Participant::factory()->create();
    $request = Request::create('/');
    $request->attributes->set('participant', $participant);

    expect(Participant::current($request)->is($participant))->toBeTrue();
});

it('refuses requests without a resolved participant', function () {
    Participant::current(Request::create('/'));
})->throws(HttpException::class);

it('orders columns by position', function () {
    $retro = Retro::factory()->create();
    $retro->columns()->create(['title' => 'B', 'color' => 'sky', 'position' => 1]);
    $retro->columns()->create(['title' => 'A', 'color' => 'moss', 'position' => 0]);

    expect($retro->columns->pluck('title')->all())->toBe(['A', 'B']);
});

it('attaches retro helpers to the team', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);

    expect($retro->team->hasMember($user))->toBeTrue()
        ->and($user->belongsToWorkspace($retro->team->workspace))->toBeTrue()
        ->and($participant->retro_id)->toBe($retro->id)
        ->and($participant->user_id)->toBe($user->id);
});

it('deletes every retro row when the retro is deleted', function () {
    $retro = Retro::factory()->create();
    [$facilitatorUser, $facilitator] = retroFacilitator($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $lead = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $facilitator->id,
    ]);
    Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $facilitator->id,
        'parent_card_id' => $lead->id,
    ]);
    $retro->forceFill(['highlighted_card_id' => $lead->id])->save();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $facilitator->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'assignee_participant_id' => $facilitator->id,
        'created_by_participant_id' => $facilitator->id,
    ]);

    $retro->delete();

    expect(Participant::where('retro_id', $retro->id)->count())->toBe(0)
        ->and(Column::where('retro_id', $retro->id)->count())->toBe(0)
        ->and(Card::where('retro_id', $retro->id)->count())->toBe(0)
        ->and(Vote::where('retro_id', $retro->id)->count())->toBe(0)
        ->and(ActionItem::where('retro_id', $retro->id)->count())->toBe(0)
        ->and(User::find($facilitatorUser->id))->not->toBeNull();
});

it('reads a summary pending for more than ten minutes as failed', function () {
    $retro = Retro::factory()->create(['summary_status' => SummaryStatus::Pending, 'summary_requested_at' => now()->subMinutes(9)]);

    expect($retro->effectiveSummaryStatus())->toBe(SummaryStatus::Pending);

    $retro->update(['summary_requested_at' => now()->subMinutes(11)]);

    expect($retro->fresh()->effectiveSummaryStatus())->toBe(SummaryStatus::Failed);

    $retro->update(['summary_status' => null]);

    expect($retro->fresh()->effectiveSummaryStatus())->toBeNull();
});
