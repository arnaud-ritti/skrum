<?php

use App\Actions\Integrations\BuildRetroRecap;
use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use App\Support\Integrations\Messages\RetroRecap;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function recapRetro(array $attributes = []): Retro
{
    return Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        'completed_at' => Date::parse('2026-09-28 15:00'),
        ...$attributes,
    ]);
}

function recapOf(Retro $retro): RetroRecap
{
    return resolve(BuildRetroRecap::class)->handle($retro->fresh());
}

function recapCard(Retro $retro, Column $column, int $votes, array $attributes = []): Card
{
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, ...$attributes]);
    Vote::factory()->count($votes)->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    return $card;
}

it('recaps a completed retro', function () {
    $retro = recapRetro();
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'zoe'])->id]);
    $adam = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Adam'])->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $adam->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $adam->id, 'parent_card_id' => $lead->id]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $adam->id, 'score' => 4]);

    app()->setLocale('fr');
    $recap = recapOf($retro);

    expect($recap->title)->toBe('Sprint 42')
        ->and($recap->teamName)->toBe('Platform')
        ->and($recap->completedOn)->toBe('28 septembre 2026')
        ->and($recap->url)->toBe(route('retros.show', $retro))
        ->and($recap->participantNames)->toBe(['Adam', 'Gus (invité)', 'zoe'])
        ->and($recap->participantCount)->toBe(3)
        ->and($recap->cardCount)->toBe(2)
        ->and($recap->rotiAverage)->toBe(4.0)
        ->and($recap->rotiRespondents)->toBe(1);
});

it('counts participants only on anonymous retros', function () {
    $retro = recapRetro(['is_anonymous' => true]);
    Participant::factory()->count(3)->create(['retro_id' => $retro->id]);

    $recap = recapOf($retro);

    expect($recap->participantNames)->toBeNull()
        ->and($recap->participantCount)->toBe(3);
});

it('includes the summary only when it is ready', function (?SummaryStatus $status, ?string $expected) {
    $retro = recapRetro([
        'summary' => 'We shipped a lot.',
        'summary_status' => $status,
        'summary_requested_at' => now(),
    ]);

    expect(recapOf($retro)->summary)->toBe($expected);
})->with([
    'ready' => [SummaryStatus::Ready, 'We shipped a lot.'],
    'pending' => [SummaryStatus::Pending, null],
    'failed' => [SummaryStatus::Failed, null],
    'never generated' => [null, null],
]);

it('lists open action items first, by priority, at most ten', function () {
    $retro = recapRetro();
    $member = User::factory()->create(['name' => 'Ada']);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    ActionItem::factory()->completed()->priority(ActionItemPriority::High)->create(['retro_id' => $retro->id, 'content' => 'Done high']);
    ActionItem::factory()->priority(ActionItemPriority::Low)->create(['retro_id' => $retro->id, 'content' => 'Open low', 'created_at' => now()->subMinute()]);
    ActionItem::factory()->priority(ActionItemPriority::High)->assignedTo($member)->create(['retro_id' => $retro->id, 'content' => "Open\n  high", 'due_on' => '2026-10-15']);
    ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Open medium']);
    ActionItem::factory()->count(8)->priority(ActionItemPriority::Low)->create(['retro_id' => $retro->id, 'content' => 'Filler']);

    $recap = recapOf($retro);

    expect($recap->actionItems)->toHaveCount(10)
        ->and($recap->hiddenActionItems)->toBe(2)
        ->and($recap->actionItems[0])->toMatchArray(['content' => 'Open high', 'assignee' => 'Ada', 'dueOn' => 'October 15, 2026', 'isCompleted' => false, 'assigneeInitials' => 'A', 'dueDay' => '15 Oct'])
        ->and($recap->actionItems[1])->toMatchArray(['content' => 'Open medium', 'assignee' => 'Gus (guest)', 'dueOn' => null, 'isCompleted' => false, 'assigneeInitials' => 'G', 'dueDay' => null])
        ->and($recap->actionItems[2]['content'])->toBe('Open low')
        ->and(collect($recap->actionItems)->pluck('content'))->not->toContain('Done high');
});

it('lists up to five pending suggestions', function () {
    $retro = recapRetro();
    SuggestedAction::factory()->count(7)->sequence(fn ($sequence) => ['position' => $sequence->index, 'content' => "Idea {$sequence->index}"])->create(['retro_id' => $retro->id]);
    SuggestedAction::factory()->rejected()->create(['retro_id' => $retro->id, 'content' => 'Rejected idea', 'position' => 10]);
    SuggestedAction::factory()->create(['retro_id' => $retro->id, 'content' => 'Promoted idea', 'position' => 11, 'status' => SuggestedActionStatus::Promoted]);

    $recap = recapOf($retro);

    expect($recap->suggestedActions)->toBe(['Idea 0', 'Idea 1', 'Idea 2', 'Idea 3', 'Idea 4'])
        ->and($recap->hiddenSuggestedActions)->toBe(2);
});

it('picks the most voted top-level card of each column', function () {
    $retro = recapRetro();
    $wins = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins', 'position' => 0]);
    $quiet = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Quiet', 'position' => 1]);
    $pains = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Pains', 'position' => 2]);
    recapCard($retro, $wins, 2, ['position' => 1, 'content' => 'Later tie']);
    $lead = recapCard($retro, $wins, 2, ['position' => 0, 'content' => 'Earlier tie']);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $wins->id, 'parent_card_id' => $lead->id]);
    recapCard($retro, $quiet, 0);
    recapCard($retro, $pains, 1, ['content' => str_repeat('a', 400)]);

    $recap = recapOf($retro);

    expect($recap->topCards)->toHaveCount(2)
        ->and($recap->topCards[0])->toBe(['column' => 'Wins', 'content' => 'Earlier tie', 'votes' => 2, 'groupedCount' => 1])
        ->and($recap->topCards[1]['column'])->toBe('Pains')
        ->and(mb_strlen($recap->topCards[1]['content']))->toBe(300)
        ->and($recap->topCards[1]['content'])->toEndWith('…');
});

it('never carries card authors, voters or comments', function () {
    $retro = recapRetro(['is_anonymous' => true]);
    $author = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Author Zelda'])->id]);
    $voter = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Voter Victor'])->id]);
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $author->id, 'content' => 'Deploys are slow']);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'content' => 'Secret comment text']);

    $serialized = json_encode(get_object_vars(recapOf($retro)), JSON_UNESCAPED_UNICODE);

    expect($serialized)->toContain('Deploys are slow')
        ->not->toContain('Author Zelda')
        ->not->toContain('Voter Victor')
        ->not->toContain('Secret comment text');
});
