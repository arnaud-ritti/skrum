<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Http;

/**
 * A retro of one column with Alice facilitating and Bob as a member, both reading English, open to guests.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     retro: Retro,
 *     column: Column,
 *     alice: User,
 *     bob: User,
 *     aliceParticipant: Participant,
 *     bobParticipant: Participant
 * }
 */
function cvrBoard(RetroPhase $phase, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create([
        'title' => 'Sprint 42',
        'votes_per_participant' => 5,
        ...$attributes,
    ]);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [
        'retro' => $retro->fresh(),
        'column' => $column,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
    ];
}

function cvrUser(string $name): User
{
    return User::factory()->create(['name' => $name, 'locale' => 'en']);
}

const CvrSettingRow = '[data-slot="setting-row"]:has-text("Max per card")';

it('refuses the board with the 403 page to a member of another team and to a user of another workspace, and sends a visitor of a retro closed to guests to the login', function () {
    ['retro' => $retro] = cvrBoard(RetroPhase::Writing, ['guest_access_enabled' => false]);
    $outsider = cvrUser('Olga Outsider');
    $retro->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);
    Team::factory()->for($retro->team->workspace)->create(['name' => 'Borealis'])->members()->attach($outsider);
    $stranger = cvrUser('Sam Stranger');
    Workspace::factory()->withMember($stranger, WorkspaceRole::Owner)->create();

    foreach ([$outsider, $stranger] as $user) {
        $this->signIn($user, "/retros/{$retro->id}")
            ->assertPresent('[data-slot="error-page"][data-status="403"]')
            ->assertNotPresent('[data-realtime]')
            ->assertDontSee('Sprint 42');
    }

    visit("/retros/{$retro->id}")->assertPathIs('/login');

    expect(Participant::query()->where('retro_id', $retro->id)->whereIn('user_id', [$outsider->id, $stranger->id])->count())->toBe(0);
});

it('hides the revealed ROTI again and reopens the vote when the facilitator leaves the phase and comes back', function () {
    ['retro' => $retro, 'alice' => $alice, 'bob' => $bob, 'bobParticipant' => $bobParticipant] = cvrBoard(RetroPhase::Roti);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 4]);
    $retro->forceFill(['roti_revealed_at' => now()])->save();
    $control = '[role="group"][aria-label="Was this time together worth it?"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSeeIn('[data-slot="roti-mean"]', '4')
        ->assertSee('Votes are closed.');

    $alicePage->click('[data-slot="phase-previous"]')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->click('[data-slot="phase-forward"]')
        ->assertSeeIn('[aria-current="step"]', 'ROTI');

    $bobPage->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->assertNotPresent('[data-slot="roti-mean"]')
        ->assertDontSee('Votes are closed.')
        ->assertSee('Results appear for everyone when the facilitator reveals them or ends the session.')
        ->click("{$control} button[data-rating=\"2\"]");

    $alicePage->assertSeeIn('[data-slot="retro-roti-count"]', '1/2');

    expect($retro->fresh()->roti_revealed_at)->toBeNull()
        ->and(RotiVote::query()->where('participant_id', $bobParticipant->id)->sole()->score)->toBe(2);
});

it('lists an item the tracker refused with its reason in the bulk export and exports it on "Retry the failed ones"', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    Http::fake([
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [['id' => '10000', 'key' => 'ATLAS', 'name' => 'Atlas']]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([['id' => '11', 'name' => 'Task', 'subtask' => false]]),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta()),
        jiraApiUrl('rest/api/3/issue') => Http::sequence()
            ->push(['errorMessages' => ['Jira is down']], 500)
            ->push(['id' => '10142', 'key' => 'ATLAS-142', 'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10142'], 201),
    ]);
    ['retro' => $retro, 'alice' => $alice, 'aliceParticipant' => $aliceParticipant] = cvrBoard(RetroPhase::Actions);
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Cache the dependencies',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);
    $row = "[data-slot=\"retro-bulk-export\"] [data-item-id=\"{$item->id}\"]";

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[data-slot="retro-bulk-export-button"]:has-text("Export to Jira")')
        ->click('[data-slot="retro-bulk-export"] button:has-text("Export 1 item")')
        ->assertSee('0 exported, 1 failed')
        ->assertPresent("{$row}[data-state=\"failed\"]")
        ->assertDontSeeIn($row, 'ATLAS-142');

    expect($item->externalLinks()->count())->toBe(0);

    $page->click('[data-slot="retro-bulk-export"] button:has-text("Retry the failed ones")')
        ->assertPresent("{$row}[data-state=\"exported\"]")
        ->assertSeeIn($row, 'ATLAS-142');

    expect($item->externalLinks()->sole()->external_key)->toBe('ATLAS-142');
});

it('offers "Max per card" with "No limit" on in the new retro dialog and creates the retro without a cap', function () {
    ['retro' => $retro, 'alice' => $alice] = cvrBoard(RetroPhase::Writing);

    $page = $this->signIn($alice, route('teams.sessions.index', [$retro->team->workspace, $retro->team], false));

    $page->click('[data-slot="sessions-page"] header button:has-text("New session")')
        ->fill('#new-retro-title', 'Uncapped retro')
        ->assertSeeIn('[role="dialog"]', 'Max per card')
        ->assertChecked('#new-retro-max-votes-per-card-auto')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/');

    expect(Retro::query()->where('title', 'Uncapped retro')->sole()->max_votes_per_card)->toBeNull();
});

it('lets the facilitator set "Max per card" in the settings during Grouping, shows the value read-only to a member and locks the row from Voting on', function () {
    ['retro' => $retro, 'alice' => $alice, 'bob' => $bob] = cvrBoard(RetroPhase::Grouping);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->click('[aria-label="Settings"]')
        ->assertSeeIn(CvrSettingRow, 'No limit')
        ->click('#retro-max-votes-per-card-auto')
        ->assertValue('#retro-max-votes-per-card', '2')
        ->click('button:has-text("Apply")')
        ->assertSee('Settings applied');

    expect($retro->fresh()->max_votes_per_card)->toBe(2);

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->click('[aria-label="Settings"]')
        ->assertSeeIn(CvrSettingRow, '2')
        ->assertNotPresent('#retro-max-votes-per-card')
        ->assertNotPresent('#retro-max-votes-per-card-auto');

    $retro->forceFill(['phase' => RetroPhase::Voting])->save();

    $alicePage->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($alicePage)
        ->click('[aria-label="Settings"]')
        ->assertSeeIn(CvrSettingRow.' [data-slot="setting-reason"]', 'The vote limit can only change before voting starts.')
        ->assertDisabled('#retro-max-votes-per-card');
});

it('keeps a retro without a cap per card as before: no cap in the vote bar, nobody finished and every vote on one card accepted', function () {
    ['retro' => $retro, 'column' => $column, 'bobParticipant' => $bobParticipant] = cvrBoard(RetroPhase::Voting, ['votes_per_participant' => 3]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'participant_id' => $bobParticipant->id, 'content' => 'Slow CI']);
    $addVote = "#card-{$card->id} [data-slot=\"retro-card-vote\"]";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertDontSeeIn('[data-slot="retro-voting-bar"]', 'per card')
        ->assertSeeIn('[data-slot="retro-finished-count"]', '0/1 have finished')
        ->click($addVote)
        ->click($addVote)
        ->click($addVote)
        ->assertPresent('[data-slot="vote-budget"] .sr-only:text-is("No votes left")')
        ->assertSeeIn('[data-slot="retro-finished-count"]', '0/1 have finished');

    expect($card->votes()->count())->toBe(3);
});
