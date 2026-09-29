<?php

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

it('moves between adjacent phases only', function () {
    expect(RetroPhase::Writing->next())->toBe(RetroPhase::Grouping)
        ->and(RetroPhase::Writing->previous())->toBeNull()
        ->and(RetroPhase::Completed->next())->toBeNull()
        ->and(RetroPhase::Voting->isAdjacentTo(RetroPhase::Grouping))->toBeTrue()
        ->and(RetroPhase::Voting->isAdjacentTo(RetroPhase::Discussing))->toBeTrue()
        ->and(RetroPhase::Writing->isAdjacentTo(RetroPhase::Voting))->toBeFalse()
        ->and(RetroPhase::Writing->isAdjacentTo(RetroPhase::Writing))->toBeFalse();
});

it('defines template columns', function () {
    expect(array_column(RetroTemplate::StartStopContinue->columns(), 'title'))->toBe(['Start', 'Stop', 'Continue'])
        ->and(RetroTemplate::FourLs->columns())->toHaveCount(4)
        ->and(RetroTemplate::Custom->columns())->toBe([])
        ->and(RetroTemplate::options())->toHaveCount(5);
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
    $retro->columns()->create(['title' => 'B', 'color' => 'blue', 'position' => 1]);
    $retro->columns()->create(['title' => 'A', 'color' => 'green', 'position' => 0]);

    expect($retro->columns->pluck('title')->all())->toBe(['A', 'B']);
});

it('attaches retro helpers to the team', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    expect($retro->team->hasMember($user))->toBeTrue()
        ->and($user->belongsToWorkspace($retro->team->workspace))->toBeTrue()
        ->and(User::count())->toBeGreaterThanOrEqual(1);
});
