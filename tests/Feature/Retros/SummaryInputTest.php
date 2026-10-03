<?php

use App\Actions\Retros\BuildSummaryInput;
use App\Actions\Retros\ParseSummaryOutput;
use App\Actions\Retros\SummaryInput;
use App\Enums\CardSentiment;
use App\Enums\RetroPhase;
use App\Enums\SurveyKind;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Survey;
use App\Models\SurveyOption;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;
use App\Models\Vote;

function completedRetroWithContent(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 12', ...$attributes]);
    [, $alice] = retroMember($retro);
    $bob = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Bobbington']);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'To improve']);
    $lead = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $alice->id, 'content' => 'Deploys are slow', 'group_name' => 'Release pain']);
    $child = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $bob->id, 'content' => 'CI is flaky', 'parent_card_id' => $lead->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $bob->id]);
    CardReaction::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $bob->id, 'emoji' => '🔥']);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $lead->id, 'participant_id' => $bob->id, 'content' => 'secret comment']);
    ActionItem::factory()->completed()->create(['retro_id' => $retro->id, 'content' => 'Cache the build', 'assignee_participant_id' => $bob->id]);

    return [$retro, $alice, $bob, $lead, $child];
}

it('sends revealed content, groups, votes and action items', function () {
    [$retro] = completedRetroWithContent();

    $payload = json_decode(resolve(BuildSummaryInput::class)->handle($retro->fresh())->payload, true);

    expect($payload['retroTitle'])->toBe('Sprint 12')
        ->and($payload['columns'])->toBe(['To improve'])
        ->and($payload['cards'][0])->toMatchArray([
            'id' => 1,
            'column' => 'To improve',
            'text' => 'Deploys are slow',
            'groupName' => 'Release pain',
            'votes' => 3,
            'grouped' => [['id' => 2, 'text' => 'CI is flaky']],
        ])
        ->and($payload['actionItems'])->toBe([['text' => 'Cache the build', 'done' => true]]);
});

it('never sends participant names or ids, authors, card uuids, reactions or comments', function (bool $anonymous) {
    [$retro, $alice, $bob, $lead, $child] = completedRetroWithContent(['is_anonymous' => $anonymous]);

    $input = resolve(BuildSummaryInput::class)->handle($retro->fresh());
    $sent = $input->instructions.$input->payload;

    expect($sent)
        ->not->toContain($alice->id)->not->toContain($bob->id)
        ->not->toContain($alice->displayName())->not->toContain('Bobbington')
        ->not->toContain($lead->id)->not->toContain($child->id)
        ->not->toContain('secret comment')->not->toContain('🔥')
        ->and($input->cardIds)->toBe([1 => $lead->id, 2 => $child->id]);
})->with(['named retro' => false, 'anonymous retro' => true]);

it('sends closed survey results without voters and text answers without authors', function () {
    [$retro, $alice, $bob] = completedRetroWithContent();
    $choice = Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Single, 'question' => 'Pace?', 'is_closed' => true, 'position' => 0]);
    $fast = SurveyOption::factory()->create(['survey_id' => $choice->id, 'label' => 'Fast', 'position' => 0]);
    SurveyOption::factory()->create(['survey_id' => $choice->id, 'label' => 'Slow', 'position' => 1]);
    SurveyResponse::factory()->create(['survey_id' => $choice->id, 'survey_option_id' => $fast->id, 'participant_id' => $bob->id]);
    $text = Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Text, 'question' => 'Ideas?', 'is_closed' => true, 'position' => 1]);
    SurveyTextAnswer::factory()->create(['survey_id' => $text->id, 'participant_id' => $bob->id, 'content' => 'Pair more']);
    Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Single, 'question' => 'Still open?', 'is_closed' => false, 'position' => 2]);

    $input = resolve(BuildSummaryInput::class)->handle($retro->fresh());
    $payload = json_decode($input->payload, true);

    expect($payload['surveys'])->toBe([
        ['question' => 'Pace?', 'kind' => 'single', 'responses' => 1, 'options' => [['label' => 'Fast', 'count' => 1], ['label' => 'Slow', 'count' => 0]]],
        ['question' => 'Ideas?', 'kind' => 'text', 'responses' => 1, 'answers' => ['Pair more']],
    ])->and($input->payload)->not->toContain('Still open?')->not->toContain($bob->id);
});

it('sends at most fifty text answers per survey', function () {
    [$retro] = completedRetroWithContent();
    $text = Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Text, 'is_closed' => true]);
    SurveyTextAnswer::factory()->count(55)->create(['survey_id' => $text->id]);

    $payload = json_decode(resolve(BuildSummaryInput::class)->handle($retro->fresh())->payload, true);

    expect($payload['surveys'][0]['answers'])->toHaveCount(50);
});

it('sends health aggregates labelled by statement and the roti aggregate', function () {
    [$retro, $alice, $bob] = completedRetroWithContent();
    attachHealthCheck($retro);
    answerHealthCheck($retro, $bob, ['interaction' => 4]);
    closeHealthCheck($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bob->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $alice->id, 'score' => 5]);

    $payload = json_decode(resolve(BuildSummaryInput::class)->handle($retro->fresh())->payload, true);

    expect($payload['health']['statements'])->toContain(['label' => 'Interaction', 'average' => 4.0])
        ->and($payload['health']['scale'])->toBe(5)
        ->and($payload['roti'])->toBe(['respondents' => 2, 'average' => 4.5]);
});

it('caps the input at thirty thousand characters keeping the most voted cards', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $popular = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'popular '.str_repeat('x', 900), 'position' => 99]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $popular->id]);
    Card::factory()->count(60)->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => str_repeat('y', 900)]);

    $input = resolve(BuildSummaryInput::class)->handle($retro->fresh());

    expect(mb_strlen($input->payload))->toBeLessThanOrEqual(BuildSummaryInput::MaxCharacters)
        ->and($input->cardIds[1])->toBe($popular->id)
        ->and(count($input->cardIds))->toBeLessThan(61);
});

it('keeps long text survey answers within the cap and still sends the cards', function () {
    [$retro, , , $lead] = completedRetroWithContent();

    foreach (range(0, 2) as $position) {
        $text = Survey::factory()->create(['retro_id' => $retro->id, 'kind' => SurveyKind::Text, 'is_closed' => true, 'position' => $position]);
        SurveyTextAnswer::factory()->count(50)->create(['survey_id' => $text->id, 'content' => str_repeat('z', 500)]);
    }

    $input = resolve(BuildSummaryInput::class)->handle($retro->fresh());

    expect(mb_strlen($input->payload))->toBeLessThanOrEqual(BuildSummaryInput::MaxCharacters)
        ->and($input->cardIds[1])->toBe($lead->id)
        ->and(json_decode($input->payload, true)['cards'])->not->toBeEmpty();
});

it('keeps many long action items within the cap', function () {
    [$retro] = completedRetroWithContent();
    ActionItem::factory()->count(80)->create(['retro_id' => $retro->id, 'content' => str_repeat('a', 500)]);

    $input = resolve(BuildSummaryInput::class)->handle($retro->fresh());

    expect(mb_strlen($input->payload))->toBeLessThanOrEqual(BuildSummaryInput::MaxCharacters)
        ->and(json_decode($input->payload, true)['cards'])->not->toBeEmpty();
});

it('writes in the creator locale', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$creator] = retroMember($retro);
    $creator->update(['locale' => 'fr']);

    expect(resolve(BuildSummaryInput::class)->outputLocale($retro->fresh()))->toBe('fr')
        ->and(resolve(BuildSummaryInput::class)->handle($retro->fresh())->instructions)->toContain('French');
});

function summaryInputFor(array $cardIds): SummaryInput
{
    return new SummaryInput('instructions', '{}', $cardIds);
}

it('parses themes, suggestions and card insights from indexes', function () {
    $input = summaryInputFor([1 => 'card-a', 2 => 'card-b', 3 => 'card-c']);
    $reply = "```json\n".json_encode([
        'summary' => '  The team shipped. ',
        'themes' => [
            ['name' => 'Release pain', 'cardIds' => [1, 2, 99]],
            ['name' => 'Duplicate card', 'cardIds' => [2, 3]],
            ['name' => '', 'cardIds' => [3]],
        ],
        'suggestedActions' => [
            ['content' => 'Automate releases', 'theme' => 'release pain'],
            ['content' => 'Unthemed step', 'theme' => 'Unknown'],
            ['content' => str_repeat('a', 501)],
        ],
        'cardInsights' => [
            ['cardId' => 1, 'sentiment' => 'negative', 'category' => 'Tooling'],
            ['cardId' => 2, 'sentiment' => 'furious', 'category' => ''],
            ['cardId' => 99, 'sentiment' => 'positive', 'category' => 'Ghost'],
        ],
    ])."\n```";

    $output = resolve(ParseSummaryOutput::class)->handle($reply, $input);

    expect($output->summary)->toBe('The team shipped.')
        ->and($output->themes)->toBe([
            ['name' => 'Release pain', 'cardIds' => ['card-a', 'card-b']],
            ['name' => 'Duplicate card', 'cardIds' => ['card-c']],
        ])
        ->and($output->suggestedActions)->toBe([
            ['content' => 'Automate releases', 'theme' => 'Release pain'],
            ['content' => 'Unthemed step', 'theme' => null],
        ])
        ->and($output->cardInsights)->toBe([
            'card-a' => ['sentiment' => CardSentiment::Negative, 'category' => 'Tooling'],
        ]);
});

it('trims the summary to two thousand characters and keeps at most eight themes and suggestions', function () {
    $input = summaryInputFor(array_combine(range(1, 9), array_map(fn (int $i) => "card-{$i}", range(1, 9))));
    $reply = json_encode([
        'summary' => str_repeat('s', 2500),
        'themes' => array_map(fn (int $i) => ['name' => "Theme {$i}", 'cardIds' => [$i]], range(1, 9)),
        'suggestedActions' => array_map(fn (int $i) => ['content' => "Step {$i}"], range(1, 9)),
    ]);

    $output = resolve(ParseSummaryOutput::class)->handle($reply, $input);

    expect(mb_strlen($output->summary))->toBe(2000)
        ->and($output->themes)->toHaveCount(8)
        ->and($output->suggestedActions)->toHaveCount(8)
        ->and($output->cardInsights)->toBeEmpty();
});

it('rejects output without a summary', function (string $reply) {
    expect(resolve(ParseSummaryOutput::class)->handle($reply, summaryInputFor([])))->toBeNull();
})->with([
    'not json' => ['no'],
    'no summary' => ['{"themes": []}'],
    'empty summary' => ['{"summary": "   "}'],
]);

it('ignores nested array indexes instead of failing', function () {
    $input = summaryInputFor([1 => 'card-a']);
    $reply = json_encode([
        'summary' => 'Fine.',
        'themes' => [['name' => 'Theme', 'cardIds' => [[1], '1', 1.5, 1]]],
        'cardInsights' => [
            ['cardId' => [1], 'sentiment' => 'positive'],
            ['cardId' => '1', 'sentiment' => 'negative'],
        ],
    ]);

    $output = resolve(ParseSummaryOutput::class)->handle($reply, $input);

    expect($output->themes)->toBe([['name' => 'Theme', 'cardIds' => ['card-a']]])
        ->and($output->cardInsights)->toBe(['card-a' => ['sentiment' => CardSentiment::Negative, 'category' => null]]);
});

it('asks for card insights on the first sixty cards only', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    Card::factory()->count(100)->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => 'Short card']);

    $input = resolve(BuildSummaryInput::class)->handle($retro->fresh());

    expect($input->cardIds)->toHaveCount(100)
        ->and($input->instructions)->toContain('only for the cards whose "id" is 60 or lower');
});

it('ignores card insights beyond the first sixty cards', function () {
    $input = summaryInputFor(array_combine(range(1, 61), array_map(fn (int $i) => "card-{$i}", range(1, 61))));
    $reply = json_encode([
        'summary' => 'Fine.',
        'cardInsights' => [
            ['cardId' => 60, 'sentiment' => 'positive'],
            ['cardId' => 61, 'sentiment' => 'negative'],
        ],
    ]);

    $output = resolve(ParseSummaryOutput::class)->handle($reply, $input);

    expect($output->cardInsights)->toBe(['card-60' => ['sentiment' => CardSentiment::Positive, 'category' => null]]);
});
