<?php

use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Survey;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function llmWithoutLlm(): void
{
    config(['services.llm' => ['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]]);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: Participant,
 *     4: Participant
 * }
 */
function llmBoard(RetroPhase $phase, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', 'ai_summary_enabled' => true, ...$attributes]);

    $columns = [];

    foreach (['Went well', 'To improve'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function llmCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0, array $attributes = []): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
        ...$attributes,
    ]);
}

function llmGroup(Retro $retro, Column $column, Participant $author, string $lead, string $child, int $position = 0): Card
{
    $leadCard = llmCard($retro, $column, $author, $lead, $position);

    llmCard($retro, $column, $author, $child, 0, ['parent_card_id' => $leadCard->id]);

    return $leadCard;
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function llmSummaryReply(array $overrides = []): array
{
    return [
        'summary' => 'The team shipped but releases hurt.',
        'themes' => [['name' => 'Release pain', 'cardIds' => [1]]],
        'suggestedActions' => [
            ['content' => 'Automate releases', 'theme' => 'Release pain'],
            ['content' => 'Keep pairing'],
        ],
        'cardInsights' => [
            ['cardId' => 1, 'sentiment' => 'negative', 'category' => 'Tooling'],
            ['cardId' => 2, 'sentiment' => 'positive', 'category' => 'Collaboration'],
        ],
        ...$overrides,
    ];
}

/**
 * @param  array<array-key, mixed>  $reply
 * @return array<string, mixed>
 */
function llmAnthropicResponse(array $reply): array
{
    return ['content' => [['type' => 'text', 'text' => (string) json_encode($reply)]]];
}

it('offers no AI summary switch in the new retrospective dialog without a complete provider configuration', function (array $llm) {
    config(['services.llm' => $llm]);

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->assertVisible('#new-retro-votes-auto')
        ->assertNotPresent('#new-retro-ai-summary')
        ->assertDontSee('Automatic AI summary');
})->with([
    'nothing configured' => [['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]],
    'a key without a model' => [['provider' => 'anthropic', 'key' => 'llm-secret-key', 'model' => null, 'base_url' => null]],
]);

it('offers no AI summary switch in the board settings without a provider', function () {
    llmWithoutLlm();

    [$retro, , $alice] = llmBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertPresent('#retro-locked')
        ->assertNotPresent('#retro-ai-summary')
        ->assertDontSee('Automatic AI summary');
});

it('offers no "Generate from a prompt" field in the survey dialog without a provider', function () {
    llmWithoutLlm();

    [$retro, , $alice] = llmBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    openQuickPoll($page)
        ->assertSee('New survey')
        ->assertVisible('#survey-question')
        ->assertNotPresent('#survey-draft-prompt')
        ->assertDontSee('Generate from a prompt');
});

it('offers no "Suggest group names" button during Grouping without a provider', function () {
    llmWithoutLlm();

    [$retro, $columns, $alice, , $bobParticipant] = llmBoard(RetroPhase::Grouping);
    $lead = llmGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSeeIn("#group-{$lead->id}", 'Name this group')
        ->assertDontSee('Suggest group names')
        ->assertDontSee('Card contents of these groups are sent to');
});

it('completes a retro without a provider: no summary section, no card insight, nothing sent', function () {
    llmWithoutLlm();
    Http::fake();

    [$retro, $columns, $alice, , $bobParticipant] = llmBoard(RetroPhase::Discussing);
    $card = llmCard($retro, $columns[1], $bobParticipant, 'Deploys are slow', 0, [
        'sentiment' => 'negative',
        'category' => 'Tooling',
    ]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Top topics')
        ->assertNotPresent('[aria-labelledby="results-summary"]')
        ->assertDontSee('Generate summary')
        ->assertDontSee('Generating the summary…')
        ->click('#completed-tab-board')
        ->assertSeeIn("#card-{$card->id}", 'Deploys are slow')
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Negative\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Tooling');

    Http::assertNothingSent();

    expect($retro->fresh()->summary_status)->toBeNull()
        ->and($retro->fresh()->summary)->toBeNull();
});

it('shows no Suggestions panel in Discussing without a provider, and shows it once a provider is configured', function () {
    llmWithoutLlm();

    [$retro, $columns, $alice, , $bobParticipant] = llmBoard(RetroPhase::Discussing);
    $card = llmCard($retro, $columns[1], $bobParticipant, 'Deploys are slow', 0, [
        'sentiment' => 'negative',
        'category' => 'Tooling',
    ]);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $theme->cards()->attach($card->id);
    SuggestedAction::factory()->create([
        'retro_id' => $retro->id,
        'theme_id' => $theme->id,
        'content' => 'Automate releases',
    ]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertPresent('[aria-label="Add an action item…"]')
        ->assertNotPresent('aside[aria-label="Suggestions"]')
        ->assertDontSee('Automate releases')
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Negative\"]");

    configureLlm();

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn('aside[aria-label="Suggestions"]', 'Theme: Release pain')
        ->assertSeeIn('aside[aria-label="Suggestions"]', 'Automate releases')
        ->assertPresent("#card-{$card->id} [aria-label=\"Negative\"]")
        ->assertSeeIn("#card-{$card->id}", 'Tooling');
});

it('creates a retro with the AI summary on by default, the new session dialog having no switch for it, and names the provider in the board settings', function () {
    configureLlm();

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 13 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:has-text("Start, Stop, Continue")')
        ->assertNotPresent('#new-retro-ai-summary')
        ->assertDontSeeIn('[role="dialog"]', 'Automatic AI summary')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header >> h1', 'Sprint 13 retro');

    expect(Retro::query()->where('title', 'Sprint 13 retro')->firstOrFail()->ai_summary_enabled)->toBeTrue();

    $this->awaitRealtime($page)
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'true')
        ->assertSeeIn('[role="dialog"]', 'Automatic AI summary')
        ->assertSeeIn('[role="dialog"]', 'its board content is sent automatically to Anthropic to write a summary');
});

it('lets the facilitator turn the AI summary off in the board settings, with the same privacy notice', function () {
    configureLlm();

    [$retro, , $alice] = llmBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'true')
        ->assertSeeIn('[role="dialog"]', 'its board content is sent automatically to Anthropic to write a summary')
        ->click('#retro-ai-summary')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'false')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    expect($retro->fresh()->ai_summary_enabled)->toBeFalse();

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'false');
});

it('locks the AI summary switch once the retro is completed', function () {
    configureLlm();

    [$retro, , $alice] = llmBoard(RetroPhase::Completed, ['completed_at' => now()]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'true')
        ->assertScript("document.querySelector('#retro-ai-summary').disabled", true);
});

it('fills the survey dialog from a prompt and puts nothing on the board until Save', function () {
    configureLlm();
    fakeLlmReply([
        'question' => 'How was the pace?',
        'description' => 'Think about the whole sprint.',
        'options' => ['Too slow', 'Right', 'Too fast'],
    ]);

    [$retro, , $alice] = llmBoard(RetroPhase::Writing);
    $surveys = 'section[aria-label="Surveys"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    openQuickPoll($alicePage)
        ->assertVisible('#survey-draft-prompt')
        ->assertSeeIn('[role="dialog"]', 'Generate from a prompt')
        ->assertSeeIn('[role="dialog"]', 'Your prompt and the retro title are sent to Anthropic.')
        ->fill('#survey-draft-prompt', 'ask about the sprint pace')
        ->click('[role="dialog"] button:has-text("Generate")')
        ->assertValue('#survey-question', 'How was the pace?')
        ->assertValue('#survey-description', 'Think about the whole sprint.')
        ->assertValue('[aria-label="Option 1"]', 'Too slow')
        ->assertValue('[aria-label="Option 2"]', 'Right')
        ->assertValue('[aria-label="Option 3"]', 'Too fast')
        ->assertNotPresent('[aria-label="Option 4"]')
        ->assertNotPresent($surveys);

    $carolPage->assertNotPresent($surveys)
        ->assertDontSee('How was the pace?');

    expect(Survey::query()->count())->toBe(0);

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key'));

    expect(llmRequestBodies())
        ->toContain('ask about the sprint pace')
        ->toContain('Sprint 12')
        ->toContain('single')
        ->not->toContain('Alice Martin')
        ->not->toContain('Carol Guest')
        ->not->toContain($alice->email);

    $alicePage->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($surveys, 'How was the pace?');

    $carolPage->assertSeeIn($surveys, 'How was the pace?');

    expect(Survey::query()->where('retro_id', $retro->id)->firstOrFail()->options()->count())->toBe(3);
});

it('fills no options when the survey is a free text question', function () {
    configureLlm();
    fakeLlmReply(['question' => 'What should we try next?', 'options' => ['First idea', 'Second idea']]);

    [$retro, , $alice] = llmBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    openQuickPoll($page)
        ->assertVisible('#survey-kind')
        ->assertPresent('[aria-label="Option 1"]')
        ->click('#survey-kind')
        ->assertPresent('[role="option"]:has-text("Free text")')
        ->click('[role="option"]:has-text("Free text")')
        ->assertNotPresent('[aria-label="Option 1"]')
        ->fill('#survey-draft-prompt', 'an open question about next steps')
        ->click('[role="dialog"] button:has-text("Generate")')
        ->assertValue('#survey-question', 'What should we try next?')
        ->assertValue('#survey-description', '')
        ->assertNotPresent('[aria-label="Option 1"]')
        ->assertDontSee('First idea');

    Http::assertSent(function (Request $request): bool {
        $sent = json_decode((string) $request['messages'][0]['content'], true);

        return $sent['kind'] === 'text' && $sent['request'] === 'an open question about next steps';
    });

    expect(Survey::query()->count())->toBe(0);
});

it('shows suggested group names only to the guest who asked, and applies an accepted or edited name for everyone', function () {
    configureLlm();
    fakeLlmReply([
        ['index' => 1, 'name' => 'Release pain'],
        ['index' => 2, 'name' => 'Team rituals'],
    ]);

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Grouping);
    $release = llmGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky', 0);
    $rituals = llmGroup($retro, $columns[0], $aliceParticipant, 'Standups run long', 'Too many meetings', 1);
    $ghost = '[title="Suggested name"]';
    $editor = '[aria-label="Group name"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSee('Suggest group names')
        ->assertSee('Card contents of these groups are sent to Anthropic.')
        ->click('Suggest group names')
        ->assertCount($ghost, 2)
        ->assertSeeIn("#group-{$release->id} {$ghost}", 'Release pain')
        ->assertSeeIn("#group-{$rituals->id} {$ghost}", 'Team rituals');

    $alicePage->assertSeeIn("#group-{$release->id}", 'Name this group')
        ->assertNotPresent($ghost)
        ->assertDontSee('Release pain')
        ->assertDontSee('Team rituals');

    expect($release->fresh()->group_name)->toBeNull()
        ->and($rituals->fresh()->group_name)->toBeNull();

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key'));

    expect(llmRequestBodies())
        ->toContain('Deploys are slow')
        ->toContain('CI is flaky')
        ->toContain('Standups run long')
        ->toContain('Too many meetings')
        ->not->toContain('Alice Martin')
        ->not->toContain('Bob Stone')
        ->not->toContain('Carol Guest')
        ->not->toContain($release->id)
        ->not->toContain($rituals->id)
        ->not->toContain($aliceParticipant->id)
        ->not->toContain($bobParticipant->id);

    $carolPage->click("#group-{$release->id} button:has-text(\"Use this name\")")
        ->assertPresent("#group-{$release->id} [aria-label=\"Rename group\"]")
        ->assertCount($ghost, 1);

    $alicePage->assertSeeIn("#group-{$release->id}", 'Release pain');
    expect($release->fresh()->group_name)->toBe('Release pain');

    $carolPage->click("#group-{$rituals->id} button:has-text(\"Edit this name\")")
        ->assertValue($editor, 'Team rituals')
        ->assertNotPresent($ghost);

    $alicePage->assertDontSee('Team rituals');

    $carolPage->keys($editor, 'Enter')
        ->assertPresent("#group-{$rituals->id} [aria-label=\"Rename group\"]")
        ->assertDontSee('Suggest group names');

    $alicePage->assertSeeIn("#group-{$rituals->id}", 'Team rituals');
    expect($rituals->fresh()->group_name)->toBe('Team rituals');
});

it('generates the summary, themes, suggested actions and card insights on completion, and sends no name, id, comment or assignee', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(llmSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Discussing);
    $slow = llmCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    $pairing = llmCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    CardComment::factory()->create([
        'retro_id' => $retro->id,
        'card_id' => $slow->id,
        'participant_id' => $bobParticipant->id,
        'content' => 'A private aside on that card',
    ]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Cache the build',
        'created_by_participant_id' => $aliceParticipant->id,
        'assignee_participant_id' => $bobParticipant->id,
    ]);
    $summary = '[aria-labelledby="results-summary"]';
    $summaryJobs = fn (): int => DB::table('jobs')->where('payload', 'like', '%GenerateRetroSummary%')->count();

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'Generating the summary…');
    }

    Http::assertNothingSent();

    expect($summaryJobs())->toBe(1)
        ->and($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Generated with Anthropic')
            ->assertDontSee('Generating the summary…')
            ->assertSeeIn($summary, 'Themes')
            ->assertPresent("{$summary} p:text-is(\"Release pain\")")
            ->assertSeeIn($summary, 'Deploys are slow')
            ->assertSeeIn($summary, 'Tooling')
            ->assertPresent("{$summary} [aria-label=\"Negative\"]")
            ->assertSeeIn($summary, 'Suggested actions')
            ->assertSeeIn($summary, 'Automate releases')
            ->assertSeeIn($summary, 'Theme: Release pain')
            ->assertSeeIn($summary, 'Keep pairing')
            ->assertScript("document.documentElement.outerHTML.includes('llm-secret-key')", false)
            ->click('#completed-tab-board')
            ->assertPresent("#card-{$slow->id} [aria-label=\"Negative\"]")
            ->assertSeeIn("#card-{$slow->id}", 'Tooling')
            ->assertPresent("#card-{$pairing->id} [aria-label=\"Positive\"]")
            ->assertSeeIn("#card-{$pairing->id}", 'Collaboration');
    }

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key')
        && $request['model'] === 'test-model');

    expect(llmRequestBodies())
        ->toContain('Sprint 12')
        ->toContain('To improve')
        ->toContain('Deploys are slow')
        ->toContain('Great pairing')
        ->toContain('Cache the build')
        ->not->toContain('Alice Martin')
        ->not->toContain('Bob Stone')
        ->not->toContain('Carol Guest')
        ->not->toContain($alice->email)
        ->not->toContain($slow->id)
        ->not->toContain($pairing->id)
        ->not->toContain($aliceParticipant->id)
        ->not->toContain($bobParticipant->id)
        ->not->toContain('A private aside on that card')
        ->and($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready)
        ->and($summaryJobs())->toBe(0);
});

it('lets the facilitator promote one suggestion and reject another, and gives the guest no button', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(llmSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Discussing);
    llmCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    llmCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';
    $automate = "{$summary} li:has-text(\"Automate releases\")";
    $keepPairing = "{$summary} li:has-text(\"Keep pairing\")";
    $promoted = "{$summary} a[title=\"Added to action items\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    $carolPage->assertSeeIn($summary, 'Automate releases')
        ->assertSeeIn($summary, 'Keep pairing')
        ->assertNotPresent("{$summary} button");

    $alicePage->assertSeeIn($automate, 'Theme: Release pain')
        ->assertCount("{$summary} button:has-text(\"Promote\")", 2)
        ->click("{$automate} button:has-text(\"Promote\")")
        ->assertSeeIn($promoted, 'Automate releases')
        ->assertCount("{$summary} button:has-text(\"Promote\")", 1);

    $item = ActionItem::query()->where('retro_id', $retro->id)->where('content', 'Automate releases')->firstOrFail();

    expect($item->theme_name)->toBe('Release pain')
        ->and($item->theme_id)->not->toBeNull();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertAttribute($promoted, 'href', "#action-item-{$item->id}")
            ->assertSeeIn("#action-item-{$item->id}", 'Automate releases')
            ->assertSeeIn("#action-item-{$item->id}", 'Theme: Release pain');
    }

    $alicePage->click("{$keepPairing} button:has-text(\"Reject\")")
        ->assertSeeIn($summary, 'Dismissed (1)')
        ->assertNotPresent("{$summary} button:has-text(\"Promote\")");

    $carolPage->assertSeeIn($summary, 'Dismissed (1)')
        ->assertNotPresent("{$summary} button");

    $statuses = $retro->suggestedActions()->pluck('status', 'content');

    expect($statuses['Automate releases'])->toBe(SuggestedActionStatus::Promoted)
        ->and($statuses['Keep pairing'])->toBe(SuggestedActionStatus::Rejected);
});

it('keeps handled suggestions on Regenerate, and on Remove clears the summary, themes and pending suggestions but not the action item\'s theme name', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    Http::fake([
        'api.anthropic.com/*' => Http::sequence()
            ->push(llmAnthropicResponse(llmSummaryReply()))
            ->push(llmAnthropicResponse(llmSummaryReply([
                'summary' => 'Second take: releases still hurt.',
                'themes' => [['name' => 'Delivery', 'cardIds' => [1]]],
                'suggestedActions' => [
                    ['content' => 'Automate releases', 'theme' => 'Delivery'],
                    ['content' => 'Keep pairing'],
                    ['content' => 'Add a release checklist', 'theme' => 'Delivery'],
                ],
            ]))),
    ]);

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Discussing);
    llmCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    llmCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';
    $promoted = "{$summary} a[title=\"Added to action items\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    $alicePage->assertSeeIn($summary, 'The team shipped but releases hurt.')
        ->click("{$summary} li:has-text(\"Automate releases\") button:has-text(\"Promote\")")
        ->assertSeeIn($promoted, 'Automate releases')
        ->click("{$summary} li:has-text(\"Keep pairing\") button:has-text(\"Reject\")")
        ->assertSeeIn($summary, 'Dismissed (1)');

    $item = ActionItem::query()->where('retro_id', $retro->id)->where('content', 'Automate releases')->firstOrFail();

    $alicePage->click("{$summary} button:has-text(\"Regenerate\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'Second take: releases still hurt.')
            ->assertDontSee('The team shipped but releases hurt.')
            ->assertPresent("{$summary} p:text-is(\"Delivery\")")
            ->assertSeeIn($summary, 'Add a release checklist')
            ->assertSeeIn($promoted, 'Automate releases')
            ->assertSeeIn($summary, 'Dismissed (1)');
    }

    $alicePage->assertCount("{$summary} button:has-text(\"Promote\")", 1);

    expect($retro->suggestedActions()->count())->toBe(3);

    $alicePage->click("{$summary} button:has-text(\"Remove\")")
        ->assertSeeIn($summary, 'Generate summary')
        ->assertDontSee('Second take: releases still hurt.')
        ->assertDontSeeIn($summary, 'Delivery')
        ->assertDontSeeIn($summary, 'Add a release checklist')
        ->assertSeeIn($promoted, 'Automate releases')
        ->assertSeeIn($summary, 'Dismissed (1)')
        ->assertSeeIn("#action-item-{$item->id}", 'Theme: Release pain');

    $carolPage->assertDontSee('Second take: releases still hurt.')
        ->assertDontSee('Add a release checklist')
        ->assertSeeIn("#action-item-{$item->id}", 'Theme: Release pain');

    $retro->refresh();

    expect($retro->summary)->toBeNull()
        ->and($retro->summary_status)->toBeNull()
        ->and($retro->themes()->count())->toBe(0)
        ->and($retro->suggestedActions()->where('status', SuggestedActionStatus::Pending)->count())->toBe(0)
        ->and($retro->suggestedActions()->count())->toBe(2)
        ->and($item->fresh()->theme_name)->toBe('Release pain')
        ->and($item->fresh()->theme_id)->toBeNull();

    Http::assertSentCount(2);
});

it('creates a retro from the dialog, then switches its AI summary off in the board settings', function () {
    configureLlm();

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 14 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:has-text("Start, Stop, Continue")')
        ->assertNotPresent('#new-retro-ai-summary')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header >> h1', 'Sprint 14 retro');

    $this->awaitRealtime($page)
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'true')
        ->click('#retro-ai-summary')
        ->assertAriaAttribute('#retro-ai-summary', 'checked', 'false')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    expect(Retro::query()->where('title', 'Sprint 14 retro')->firstOrFail()->ai_summary_enabled)->toBeFalse();
});

it('sends nothing when an opted-out retro is completed, until the facilitator clicks "Generate summary"', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(llmSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Discussing, ['ai_summary_enabled' => false]);
    llmCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    llmCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';
    $summaryJobs = fn (): int => DB::table('jobs')->where('payload', 'like', '%GenerateRetroSummary%')->count();

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSeeIn($summary, 'Generate summary')
        ->assertSeeIn($summary, 'The board content is sent to Anthropic to write the summary.')
        ->assertDontSee('Generating the summary…');

    $carolPage->assertSee('Top topics')
        ->assertNotPresent($summary);

    Http::assertNothingSent();

    expect($summaryJobs())->toBe(0)
        ->and($retro->fresh()->summary_status)->toBeNull();

    $alicePage->click("{$summary} button:has-text(\"Generate summary\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $carolPage->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Generated with Anthropic');
    }

    Http::assertSentCount(1);
});

it('offers no "Suggest group names" button on an opted-out retro', function () {
    configureLlm();
    Http::fake();

    [$retro, $columns, $alice, , $bobParticipant] = llmBoard(RetroPhase::Grouping, ['ai_summary_enabled' => false]);
    $lead = llmGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSeeIn("#group-{$lead->id}", 'Name this group')
        ->assertDontSee('Suggest group names');

    Http::assertNothingSent();
});

it('shows the failure to the facilitator after the provider failed three times, and generates the summary on Retry', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    Http::fake([
        'api.anthropic.com/*' => Http::sequence()
            ->push(['error' => ['message' => 'overloaded']], 500)
            ->push(['error' => ['message' => 'overloaded']], 500)
            ->push(['error' => ['message' => 'overloaded']], 500)
            ->push(llmAnthropicResponse(llmSummaryReply())),
    ]);

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Discussing);
    llmCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    llmCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');
    $carolPage->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();
    $this->travel(11)->seconds();
    $this->workQueue();

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending);

    $this->travel(61)->seconds();
    $this->workQueue();

    $alicePage->assertSeeIn($summary, 'The summary could not be generated')
        ->assertSeeIn($summary, 'The board content is sent to Anthropic to write the summary.')
        ->assertPresent("{$summary} button:has-text(\"Retry\")")
        ->assertDontSee('Generating the summary…')
        ->assertDontSee('overloaded');

    $carolPage->assertNotPresent($summary)
        ->assertDontSee('The summary could not be generated');

    Http::assertSentCount(3);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Failed)
        ->and($retro->fresh()->summary)->toBeNull();

    $alicePage->click("{$summary} button:has-text(\"Retry\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->workQueue();

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($summary, 'The team shipped but releases hurt.')
            ->assertSeeIn($summary, 'Automate releases');
    }

    Http::assertSentCount(4);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready);
});

it('treats a summary still pending after ten minutes as failed and lets the facilitator retry', function () {
    config(['queue.default' => 'database']);
    configureLlm();
    fakeLlmReply(llmSummaryReply());

    [$retro, $columns, $alice, $aliceParticipant, $bobParticipant] = llmBoard(RetroPhase::Discussing);
    llmCard($retro, $columns[1], $aliceParticipant, 'Deploys are slow', 0);
    llmCard($retro, $columns[0], $bobParticipant, 'Great pairing', 1);
    $summary = '[aria-labelledby="results-summary"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->travel(9)->minutes();

    $alicePage->navigate("/retros/{$retro->id}")
        ->assertSeeIn($summary, 'Generating the summary…');

    $this->travel(2)->minutes();

    $alicePage->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($alicePage);

    $alicePage->assertSeeIn($summary, 'The summary could not be generated')
        ->assertPresent("{$summary} button:has-text(\"Retry\")")
        ->assertDontSee('Generating the summary…');

    Http::assertNothingSent();

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Pending)
        ->and(DB::table('jobs')->count())->toBe(1);

    $alicePage->click("{$summary} button:has-text(\"Retry\")")
        ->assertSeeIn($summary, 'Generating the summary…');

    expect(DB::table('jobs')->count())->toBe(2);

    $this->workQueue();

    $alicePage->assertSeeIn($summary, 'The team shipped but releases hurt.')
        ->assertSeeIn($summary, 'Generated with Anthropic');

    Http::assertSentCount(1);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready)
        ->and(DB::table('jobs')->count())->toBe(1);

    $this->workQueue();

    Http::assertSentCount(1);

    expect($retro->fresh()->summary_status)->toBe(SummaryStatus::Ready)
        ->and($retro->fresh()->summary)->not->toBeNull()
        ->and(DB::table('jobs')->count())->toBe(0);

    $alicePage->navigate("/retros/{$retro->id}")
        ->assertSeeIn($summary, 'The team shipped but releases hurt.');
});
