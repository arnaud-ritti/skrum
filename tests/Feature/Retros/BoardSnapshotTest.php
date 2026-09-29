<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\PresentCard;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;

function snapshotFor(Retro $retro, Participant $viewer): array
{
    return app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
}

function snapshotCard(array $snapshot, Card $card): array
{
    return collect($snapshot['cards'])->firstWhere('id', $card->id);
}

it('hides other participants cards while writing', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $othersCard = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'secret thought']);
    $ownCard = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $viewer->id, 'content' => 'mine']);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $othersCard))->toMatchArray(['content' => null, 'author' => null, 'isMine' => false])
        ->and(snapshotCard($snapshot, $ownCard))->toMatchArray(['content' => 'mine', 'isMine' => true])
        ->and(json_encode($snapshot))->not->toContain('secret thought')
        ->and(json_encode($snapshot['cards']))->not->toContain($othersCard->participant_id);
});

it('reveals content and authors after writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'revealed']);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card))->toMatchArray([
        'content' => 'revealed',
        'author' => ['id' => $card->participant_id, 'name' => $card->participant->displayName()],
    ]);
});

it('never reveals authors in anonymous retros', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->anonymous()->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $card)['author'])->toBeNull()
        ->and(json_encode($snapshot['cards']))->not->toContain($card->participant_id);
})->with([RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Completed]);

it('presents cards for other participants when there is no viewer', function () {
    $retro = Retro::factory()->create();
    $card = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'hidden']);

    expect(app(PresentCard::class)->handle($card, $retro, null))
        ->toMatchArray(['content' => null, 'author' => null, 'isMine' => false]);
});

it('hides vote totals until discussing but always shows own votes', function (RetroPhase $phase, ?int $expectedTotal) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $card))->toMatchArray(['votes' => $expectedTotal, 'myVotes' => 2])
        ->and($snapshot['viewer']['remainingVotes'])->toBe(3);
})->with([
    'voting' => [RetroPhase::Voting, null],
    'discussing' => [RetroPhase::Discussing, 3],
    'completed' => [RetroPhase::Completed, 3],
]);

it('reports only the overall vote count while voting', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $viewer] = retroMember($retro);
    Vote::factory()->count(4)->create(['retro_id' => $retro->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect($snapshot['votesCast'])->toBe(4)
        ->and(json_encode($snapshot))->not->toContain('participant_id');
});

it('describes the viewer, participants, columns and links', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Visitor']);

    $snapshot = snapshotFor($retro, $facilitator);
    $guestSnapshot = snapshotFor($retro, $guest);

    expect($snapshot['viewer'])->toMatchArray(['participantId' => $facilitator->id, 'isFacilitator' => true, 'isGuest' => false])
        ->and($snapshot['retro'])->toMatchArray(['id' => $retro->id, 'phase' => 'writing', 'isAnonymous' => false, 'votesPerParticipant' => 5])
        ->and($snapshot['retro'])->not->toHaveKey('guestToken')
        ->and(collect($snapshot['participants'])->firstWhere('id', $guest->id))->toMatchArray(['name' => 'Visitor', 'isGuest' => true, 'avatarUrl' => $guest->avatarUrl()])
        ->and($snapshot['links']['team'])->toBe(route('teams.show', [$retro->team->workspace, $retro->team]))
        ->and($guestSnapshot['links']['team'])->toBeNull()
        ->and(json_encode($snapshot))->not->toContain($retro->guest_token);
});

it('keeps cards of deleted users readable', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $card->participant->user->delete();

    expect(snapshotCard(snapshotFor($retro, $viewer), $card)['author']['name'])->toBe('Former member');
});

it('lists action items with assignees', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'assignee_participant_id' => $viewer->id, 'content' => 'Fix CI']);

    expect(snapshotFor($retro, $viewer)['actionItems'])->toBe([[
        'id' => $item->id,
        'content' => 'Fix CI',
        'isDone' => false,
        'assignee' => ['id' => $viewer->id, 'name' => $viewer->displayName()],
    ]]);
});

it('reports the server time for clock offsets', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $this->freezeTime();

    expect(snapshotFor($retro, $viewer)['serverTime'])->toBe(now()->utc()->format('Y-m-d\TH:i:s.v\Z'));
});

it('lists handover candidates for the facilitator only', function () {
    $retro = Retro::factory()->create();
    [$facilitatorUser, $facilitator] = retroFacilitator($retro);
    [$memberUser, $member] = retroMember($retro);
    $admin = User::factory()->create(['name' => 'Aaron Admin']);
    $retro->team->workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $outsider = User::factory()->create();
    $retro->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $candidates = snapshotFor($retro, $facilitator)['viewer']['transferCandidates'];

    expect(collect($candidates)->pluck('userId')->all())->toBe(collect([$admin, $memberUser])->sortBy('name')->pluck('id')->values()->all())
        ->and(collect($candidates)->pluck('userId'))->not->toContain($facilitatorUser->id)
        ->and(collect($candidates)->pluck('userId'))->not->toContain($outsider->id)
        ->and(snapshotFor($retro, $member)['viewer']['transferCandidates'])->toBe([]);
});

it('exposes the current vote version', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_version' => 7]);
    [, $viewer] = retroMember($retro);

    expect(snapshotFor($retro, $viewer)['votesVersion'])->toBe(7);
});

it('reads the vote version together with the vote counts rather than from a stale retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $staleRetro = $retro->fresh();

    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id]);
    Retro::query()->whereKey($retro->id)->increment('votes_version');

    $snapshot = app(BuildBoardSnapshot::class)->handle($staleRetro, $viewer);

    expect($snapshot['votesCast'])->toBe(1)
        ->and($snapshot['votesVersion'])->toBe(1);
});
