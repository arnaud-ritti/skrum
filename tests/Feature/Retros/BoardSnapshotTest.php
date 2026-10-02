<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\PresentCard;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;

function snapshotFor(Retro $retro, Participant $viewer): array
{
    return resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
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

    expect(resolve(PresentCard::class)->handle($card, $retro, null))
        ->toMatchArray(['content' => null, 'author' => null, 'isMine' => false]);
});

it('shows vote totals while voting unless hidden, and always shows own votes', function (RetroPhase $phase, bool $hidden, ?int $expectedTotal) {
    $retro = Retro::factory()->inPhase($phase)->create(['hide_vote_counts' => $hidden]);
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $card))->toMatchArray(['votes' => $expectedTotal, 'myVotes' => 2])
        ->and($snapshot['viewer']['remainingVotes'])->toBe(3);
})->with([
    'voting, hidden' => [RetroPhase::Voting, true, null],
    'voting, visible' => [RetroPhase::Voting, false, 3],
    'discussing, hidden' => [RetroPhase::Discussing, true, 3],
    'actions, hidden' => [RetroPhase::Actions, true, 3],
    'roti, hidden' => [RetroPhase::Roti, true, 3],
    'completed' => [RetroPhase::Completed, false, 3],
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
        ->and($snapshot['retro']['teamName'])->toBe($retro->team->name)
        ->and($guestSnapshot['retro']['teamName'])->toBeNull()
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
    [$user, $viewer] = retroMember($retro);
    $item = ActionItem::factory()->assignedTo($user)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $viewer->id,
        'content' => 'Fix CI',
    ]);

    $actionItems = snapshotFor($retro, $viewer)['actionItems'];

    expect($actionItems)->toHaveCount(1)
        ->and($actionItems[0])->toMatchArray([
            'id' => $item->id,
            'content' => 'Fix CI',
            'status' => 'open',
            'assignee' => ['kind' => 'member', 'id' => $user->id, 'name' => $user->name, 'avatarUrl' => $user->avatarUrl(), 'isTeamMember' => true],
            'isMine' => true,
            'themeId' => null,
            'themeName' => null,
        ]);
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

    $snapshot = resolve(BuildBoardSnapshot::class)->handle($staleRetro, $viewer);

    expect($snapshot['votesCast'])->toBe(1)
        ->and($snapshot['votesVersion'])->toBe(1);
});

it('describes the engagement settings', function () {
    $retro = Retro::factory()->create(['cursors_enabled' => false, 'is_locked' => true]);
    [, $viewer] = retroMember($retro);

    expect(snapshotFor($retro, $viewer)['retro'])->toMatchArray([
        'reactionsEnabled' => true,
        'cursorsEnabled' => false,
        'gifsEnabled' => true,
        'hideVoteCounts' => false,
        'isLocked' => true,
        'presentationMode' => false,
    ]);
});

it('lists reactions on visible cards with the viewer own flag', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id, 'emoji' => '👍']);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card)['reactions'])
        ->toBe([['emoji' => '👍', 'count' => 1, 'mine' => true, 'names' => [$viewer->displayName()]]]);
});

it('lists comment threads with replies and counts visible comments', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $thread = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $viewer->id, 'created_at' => now()->subMinutes(3)]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $thread->id, 'created_at' => now()->subMinutes(2)]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'content' => null, 'deleted_at' => now(), 'created_at' => now()->subMinute()]);

    $presented = snapshotCard(snapshotFor($retro, $viewer), $card);

    expect($presented['commentCount'])->toBe(2)
        ->and($presented['comments'][0]['id'])->toBe($thread->id)
        ->and($presented['comments'][0]['isMine'])->toBeTrue()
        ->and($presented['comments'][0]['replies'])->toHaveCount(1)
        ->and($presented['comments'][1])->toMatchArray(['deleted' => true, 'content' => null, 'author' => null]);
});

it('hides gifs, reactions and comments of others when the facilitator steps back to writing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'gif_id' => 'abc123']);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $retro->update(['phase' => RetroPhase::Writing]);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card))->toMatchArray([
        'hidden' => true,
        'content' => null,
        'gif' => null,
        'reactions' => [],
        'commentCount' => 0,
        'comments' => [],
    ]);
});

it('loads reactions and comments with a constant number of queries', function () {
    warmInstanceSettings();
    $retro = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Discussing)->create();
    resolve(FreezeHealthStatements::class)->handle($retro);
    [, $viewer] = retroMember($retro);

    $seed = function (int $cards) use ($retro): void {
        Participant::factory()->count($cards)->create(['retro_id' => $retro->id])->each(function (Participant $participant) use ($retro): void {
            HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => 'vision']);
            HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => 'motivation']);
        });

        Card::factory()->count($cards)->create(['retro_id' => $retro->id])->each(function (Card $card) use ($retro): void {
            CardReaction::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
            $thread = CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);
            CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'parent_comment_id' => $thread->id]);
        });
    };

    $countQueries = function () use ($retro, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        snapshotFor($retro, $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});

it('names the gif provider only when gifs can be used', function (?string $provider, ?string $key, ?string $expected) {
    config(['services.gifs' => ['provider' => $provider, 'key' => $key, 'rating' => 'pg']]);
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    expect(snapshotFor($retro, $viewer)['retro']['gifProvider'])->toBe($expected);
})->with([
    'giphy' => ['giphy', 'secret-key', 'giphy'],
    'tenor' => ['tenor', 'secret-key', 'tenor'],
    'no key' => ['giphy', null, null],
    'no provider' => [null, 'secret-key', null],
]);

it('leaves out gif urls when no gif provider is configured', function () {
    config(['services.gifs' => ['provider' => null, 'key' => null, 'rating' => 'pg']]);
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'gif_id' => 'abc123']);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card)['gif'])->toBeNull();
});

it('presents a card gif through the proxy when a provider is configured', function () {
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'secret-key', 'rating' => 'pg']]);
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $viewer] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'gif_id' => 'abc123']);

    expect(snapshotCard(snapshotFor($retro, $viewer), $card)['gif'])->toBe([
        'id' => 'abc123',
        'previewUrl' => '/gifs/abc123/preview',
        'url' => '/gifs/abc123/full',
    ]);
});

it('points the emoji picker at the self-hosted emoji data in the viewer locale', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    app()->setLocale('fr');

    expect(snapshotFor($retro, $viewer)['emojiData'])->toBe([
        'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
        'locale' => 'fr',
    ]);
});

it('hides others cards again in the pre-writing phases', function (RetroPhase $phase) {
    $retro = Retro::factory()->withHealthCheck()->withIcebreaker()->inPhase($phase)->create();
    [, $viewer] = retroMember($retro);
    $othersCard = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'written before moving back']);

    $snapshot = snapshotFor($retro, $viewer);

    expect(snapshotCard($snapshot, $othersCard))->toMatchArray(['hidden' => true, 'content' => null, 'author' => null, 'gif' => null])
        ->and(json_encode($snapshot))->not->toContain('written before moving back');
})->with([RetroPhase::HealthCheck, RetroPhase::Icebreaker]);

it('exposes the enabled phases and toggles', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create();
    [, $viewer] = retroMember($retro);

    expect(snapshotFor($retro, $viewer)['retro'])->toMatchArray([
        'phase' => 'icebreaker',
        'phases' => ['icebreaker', 'writing', 'grouping', 'voting', 'discussing', 'actions', 'roti', 'completed'],
        'healthCheckEnabled' => false,
        'icebreakerEnabled' => true,
    ]);
});

it('sends the effective vote limit and whether it is automatic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null]);
    [, $viewer] = retroMember($retro);
    Card::factory()->count(2)->create(['retro_id' => $retro->id]);

    $snapshot = snapshotFor($retro, $viewer);

    expect($snapshot['retro'])->toMatchArray(['votesPerParticipant' => 5, 'votesAuto' => true])
        ->and($snapshot['viewer']['remainingVotes'])->toBe(5);
});
