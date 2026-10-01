<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function p08eWithoutLlm(): void
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
function p08eBoard(RetroPhase $phase, array $attributes = []): array
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
function p08eCard(Retro $retro, Column $column, Participant $author, string $content, int $position = 0, array $attributes = []): Card
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

function p08eGroup(Retro $retro, Column $column, Participant $author, string $lead, string $child, int $position = 0): Card
{
    $leadCard = p08eCard($retro, $column, $author, $lead, $position);

    p08eCard($retro, $column, $author, $child, 0, ['parent_card_id' => $leadCard->id]);

    return $leadCard;
}

it('[P08e-01a] offers no AI summary switch in the new retrospective dialog without a complete provider configuration', function (array $llm) {
    config(['services.llm' => $llm]);

    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->click('[role="dialog"] [data-slot="collapsible-trigger"]')
        ->assertVisible('#new-retro-votes-auto')
        ->assertNotPresent('#new-retro-ai-summary')
        ->assertDontSee('Automatic AI summary');
})->with([
    'nothing configured' => [['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]],
    'a key without a model' => [['provider' => 'anthropic', 'key' => 'llm-secret-key', 'model' => null, 'base_url' => null]],
]);

it('[P08e-01b] offers no AI summary switch in the board settings without a provider', function () {
    p08eWithoutLlm();

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertPresent('#retro-locked')
        ->assertNotPresent('#retro-ai-summary')
        ->assertDontSee('Automatic AI summary');
});

it('[P08e-02a] offers no "Generate from a prompt" field in the survey dialog without a provider', function () {
    p08eWithoutLlm();

    [$retro, , $alice] = p08eBoard(RetroPhase::Writing);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSee('Add survey')
        ->click('Add survey')
        ->assertSee('New survey')
        ->assertVisible('#survey-question')
        ->assertNotPresent('#survey-draft-prompt')
        ->assertDontSee('Generate from a prompt');
});

it('[P08e-02b] offers no "Suggest group names" button during Grouping without a provider', function () {
    p08eWithoutLlm();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Grouping);
    $lead = p08eGroup($retro, $columns[1], $bobParticipant, 'Deploys are slow', 'CI is flaky');

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSeeIn("#card-{$lead->id}", 'Name this group')
        ->assertDontSee('Suggest group names')
        ->assertDontSee('Card contents of these groups are sent to');
});

it('[P08e-03a] completes a retro without a provider: no summary section, no card insight, nothing sent', function () {
    p08eWithoutLlm();
    Http::fake();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    $card = p08eCard($retro, $columns[1], $bobParticipant, 'Deploys are slow', 0, [
        'sentiment' => 'negative',
        'category' => 'Tooling',
    ]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->press('Complete')
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

it('[P08e-03b] shows no Suggestions panel in Discussing without a provider, and shows it once a provider is configured', function () {
    p08eWithoutLlm();

    [$retro, $columns, $alice, , $bobParticipant] = p08eBoard(RetroPhase::Discussing);
    $card = p08eCard($retro, $columns[1], $bobParticipant, 'Deploys are slow', 0, [
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
