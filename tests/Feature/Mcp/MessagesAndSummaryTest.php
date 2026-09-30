<?php

use App\Enums\CardSentiment;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListMessages;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;

/**
 * @return array{0: Retro, 1: User, 2: Participant, 3: Column}
 */
function mcpMessagesBoard(RetroPhase $phase, bool $anonymous = false): array
{
    $retro = Retro::factory()->inPhase($phase)->create(['is_anonymous' => $anonymous]);
    [$user, $participant] = retroMember($retro);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Went well', 'description' => 'Wins']);

    return [$retro, $user, $participant, $column];
}

it('hides other participants cards in the writing phase and shows the viewer own', function () {
    configureLlm();
    [$retro, $user, $participant, $column] = mcpMessagesBoard(RetroPhase::Writing);
    $mine = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id, 'content' => 'My idea']);
    $theirs = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Secret idea']);
    $theirs->forceFill(['sentiment' => CardSentiment::Negative, 'category' => 'Process'])->save();

    $response = actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id])->assertOk();
    $messages = collect(mcpStructured($response)['columns'][0]['messages'])->keyBy('id');

    expect($messages[$mine->id])->toMatchArray(['hidden' => false, 'content' => 'My idea', 'isMine' => true])
        ->and($messages[$theirs->id])->toMatchArray(['hidden' => true, 'content' => null, 'author' => null, 'sentiment' => null, 'category' => null, 'groupName' => null, 'reactions' => [], 'commentCount' => 0]);

    $response->assertDontSee('Secret idea');
});

it('shows every card with authors, totals, reactions and insights once discussing', function () {
    configureLlm();
    [$retro, $user, $participant, $column] = mcpMessagesBoard(RetroPhase::Discussing);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Lead', 'group_name' => 'Deploys']);
    $lead->forceFill(['sentiment' => CardSentiment::Positive, 'category' => 'Delivery'])->save();
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'parent_card_id' => $lead->id, 'content' => 'Child']);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $lead->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'emoji' => '🎉']);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id]);

    $messages = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id]))['columns'][0]['messages'];

    expect($messages)->toHaveCount(1)
        ->and($messages[0])->toMatchArray([
            'id' => $lead->id,
            'content' => 'Lead',
            'votes' => 2,
            'sentiment' => 'positive',
            'category' => 'Delivery',
            'groupName' => 'Deploys',
            'reactions' => [['emoji' => '🎉', 'count' => 1]],
            'commentCount' => 1,
        ])
        ->and($messages[0]['author']['name'])->toBe($lead->participant->displayName())
        ->and(collect($messages[0]['grouped'])->pluck('id')->all())->toBe([$child->id]);
});

it('never names authors on anonymous boards except the viewer', function () {
    [$retro, $user, $participant, $column] = mcpMessagesBoard(RetroPhase::Discussing, anonymous: true);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $participant->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);

    $messages = collect(mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id]))['columns'][0]['messages']);

    expect($messages->where('isMine', true)->first()['author'])->not->toBeNull()
        ->and($messages->where('isMine', false)->first()['author'])->toBeNull();
});

it('reads a board without joining it', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $user = teamMember($retro->team);
    Card::factory()->create(['retro_id' => $retro->id]);

    actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id])->assertOk();

    expect(Participant::query()->where('retro_id', $retro->id)->where('user_id', $user->id)->exists())->toBeFalse();
});

it('hides vote totals when the board hides them and refuses sorting by votes', function () {
    [$retro, $user, , $column] = mcpMessagesBoard(RetroPhase::Voting);
    $retro->update(['hide_vote_counts' => true]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $messages = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id]))['columns'][0]['messages'];

    expect($messages[0]['votes'])->toBeNull();

    actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'sort' => 'votes'])
        ->assertHasErrors(['Vote totals are not visible yet.']);
});

it('sorts by votes, filters a column and paginates', function () {
    [$retro, $user, , $column] = mcpMessagesBoard(RetroPhase::Discussing);
    $other = Column::factory()->create(['retro_id' => $retro->id, 'position' => 1]);
    $low = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'position' => 0]);
    $high = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'position' => 1]);
    Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $other->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $high->id]);

    $sorted = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'column_id' => $column->id, 'sort' => 'votes']));

    expect($sorted['columns'])->toHaveCount(1)
        ->and(collect($sorted['columns'][0]['messages'])->pluck('id')->all())->toBe([$high->id, $low->id]);

    $page = mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'limit' => 2]));

    expect($page['hasMore'])->toBeTrue()
        ->and(collect($page['columns'])->flatMap(fn (array $column) => $column['messages'])->count())->toBe(2);

    actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id, 'limit' => 201])->assertHasErrors();
});

it('hides boards of other teams', function () {
    $retro = Retro::factory()->create();

    actingAsMcp(teamMember(Team::factory()->create()))->tool(ListMessages::class, ['board_id' => $retro->id])->assertHasErrors(['Not found.']);
});

it('returns the ready summary of a completed board with its participants', function () {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary' => 'We shipped.',
        'summary_status' => SummaryStatus::Ready,
        'ai_summary_enabled' => true,
        'summary_generated_at' => now(),
    ]);
    [$user] = retroMember($retro);

    $result = mcpStructured(actingAsMcp($user)->tool(GetSummary::class, ['board_id' => $retro->id])->assertOk());

    expect($result['summary']['text'])->toBe('We shipped.')
        ->and($result['summaryStatus'])->toBe('ready')
        ->and($result['board']['id'])->toBe($retro->id)
        ->and($result['participants'][0])->toHaveKeys(['name', 'avatarUrl']);
});

it('returns no summary while pending, when opted out, without provider or before completion', function (string $case) {
    configureLlm();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'summary' => 'Text',
        'summary_status' => SummaryStatus::Ready,
        'ai_summary_enabled' => true,
        'summary_generated_at' => now(),
    ]);

    match ($case) {
        'pending' => $retro->update(['summary_status' => SummaryStatus::Pending, 'summary_requested_at' => now()]),
        'opted out' => $retro->update(['ai_summary_enabled' => false]),
        'no provider' => config(['services.llm.provider' => null]),
        'in progress' => $retro->update(['phase' => RetroPhase::Discussing]),
    };

    [$user] = retroMember($retro);

    expect(mcpStructured(actingAsMcp($user)->tool(GetSummary::class, ['board_id' => $retro->id]))['summary'])->toBeNull();
})->with(['pending', 'opted out', 'no provider', 'in progress']);
