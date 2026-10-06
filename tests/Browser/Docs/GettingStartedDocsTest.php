<?php

use App\Enums\ColumnColor;
use App\Enums\JoinableSessionKind;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Models\Vote;
use App\Support\RetroTemplates\TemplateCatalogue;
use Tests\Browser\Support\DocsWorld;

const DocsGettingStartedGuestToken = 'docs-guest-link-of-the-sprint-43-retro-1';

const DocsGettingStartedJoinCode = 'H7K-P4M2';

/**
 * @return array{
 *     0: Retro,
 *     1: array<string, Participant>
 * }
 */
function docsGettingStartedRetro(DocsWorld $world, RetroPhase $phase): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create([
        'id' => '0199d0c5-0000-7000-8000-000000000101',
        'team_id' => $world->team->id,
        'title' => 'Sprint 43 retro',
        'template' => 'start_stop_continue',
        'guest_token' => DocsGettingStartedGuestToken,
    ]);

    $participants = [];

    foreach (['Théo', 'Inès', 'Malik', 'Sofia'] as $index => $firstName) {
        $participants[$firstName] = Participant::factory()->create([
            'id' => sprintf('0199d0c5-0000-7000-8000-%012d', 201 + $index),
            'retro_id' => $retro->id,
            'user_id' => $world->person($firstName)->id,
        ]);
    }

    $retro->forceFill(['facilitator_participant_id' => $participants['Théo']->id])->save();

    $cards = [
        'Start' => [
            ['Théo', 'Pair on the code reviews of the checkout work'],
            ['Inès', 'Write the release notes as we merge'],
            ['Malik', 'Show support a demo before each release'],
        ],
        'Stop' => [
            ['Théo', 'Starting new stories two days before the sprint ends'],
            ['Sofia', 'Skipping the review of last retro’s actions'],
        ],
        'Continue' => [
            ['Théo', 'Stand-ups of fifteen minutes at most'],
            ['Inès', 'Mob sessions on the hard bugs'],
        ],
    ];

    foreach (TemplateCatalogue::find('start_stop_continue')->translatedColumns() as $position => $definition) {
        $column = Column::factory()->create([...$definition, 'retro_id' => $retro->id, 'position' => $position]);

        foreach ($cards[$definition['title']] as $cardPosition => [$author, $content]) {
            boardCard($retro, $column, $participants[$author], $content, $cardPosition);
        }
    }

    SessionJoinCode::factory()->create([
        'code' => DocsGettingStartedJoinCode,
        'session_kind' => JoinableSessionKind::Retro,
        'session_id' => $retro->id,
    ]);

    return [$retro->fresh(), $participants];
}

/**
 * @param  array<string, Participant>  $participants
 * @param  array<int, array{0: string, 1: string, 2: int}>  $votes
 */
function docsGettingStartedVotes(Retro $retro, array $participants, array $votes): void
{
    foreach ($votes as [$content, $voter, $count]) {
        Vote::factory()->count($count)->create([
            'retro_id' => $retro->id,
            'card_id' => Card::query()->where('retro_id', $retro->id)->where('content', 'like', $content)->sole()->id,
            'participant_id' => $participants[$voter]->id,
        ]);
    }
}

it('shows the workspace home with the Atlas team and its retro in progress', function () {
    $world = DocsWorld::create();
    $world->team->update(['color' => ColumnColor::Moss]);

    docsGettingStartedRetro($world, RetroPhase::Writing);
    teamActionItem($world->team, $world->person('Camille'), 'Book the room for the sprint review');
    teamActionItem($world->team, $world->person('Théo'), 'Archive the old staging environment');

    $page = $this->docsVisit($world->person('Camille'), route('workspaces.show', $world->workspace, false))
        ->assertSeeIn('[data-slot="workspace-header"]', 'Nordlys')
        ->assertSeeIn('a[data-slot="team-tile"]', 'Atlas')
        ->assertSeeIn('a[data-slot="team-tile"]', 'Retro in progress')
        ->assertSeeIn('a[data-slot="team-tile"] [data-slot="team-actions"]', '2 open action items')
        ->assertPresent('[data-slot="new-team-tile"]')
        ->assertPresent('[data-sidebar="sidebar"] a:has-text("All teams")')
        ->assertPresent('[data-sidebar="sidebar"] a:has-text("Home")')
        ->assertScript('document.querySelectorAll(\'[data-slot="workspace-overview"] .animate-pulse\').length', 0);

    $this->docShot($page, 'getting-started/workspace-home', '[data-slot="workspace-overview"]');
});

it('shows the new session dialog of the team page on a retrospective from the Start, Stop, Continue template', function () {
    $world = DocsWorld::create();
    $dialog = '[data-dialog="new-session"]';
    $template = "{$dialog} [role=\"radiogroup\"][aria-label=\"Retrospective template\"] [role=\"radio\"]";

    $page = $this->docsVisit($world->person('Théo'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]')
        ->click('New session')
        ->assertPresent("{$dialog} [data-slot=\"retro-session-fields\"]")
        ->assertSeeIn("{$dialog} [data-slot=\"session-types\"]", 'Retro')
        ->assertValue('#new-retro-title', 'Sprint 43 retro')
        ->click("{$template}:has-text(\"Start, Stop, Continue\")")
        ->assertSeeIn("{$template}[aria-checked=\"true\"]", 'Start, Stop, Continue')
        ->assertSeeIn("{$dialog} [data-slot=\"template-browse\"]", 'Browse')
        ->assertSeeIn("{$dialog} label[for=\"new-retro-guests\"]", 'Allow guests without an account')
        ->assertSeeIn("{$dialog} button[type=\"submit\"]", 'Create & open')
        ->assertDontSeeIn($dialog, 'Loading templates…')
        ->assertScript('document.querySelectorAll(\'[data-dialog="new-session"] .animate-pulse\').length', 0);

    $this->docShot($page, 'getting-started/new-session', $dialog);
});

it('shows the board in the writing phase, with the facilitator’s own cards and the hidden cards of the others', function () {
    $world = DocsWorld::create();
    [$retro] = docsGettingStartedRetro($world, RetroPhase::Writing);

    $page = $this->docsVisit($world->person('Théo'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertSeeIn('[data-slot="live-session-banner"]', 'Sprint 43 retro')
        ->assertSeeIn('[data-slot="live-session-banner"]', 'Join');

    $page->navigate(route('retros.show', $retro, false))
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertSeeIn('[aria-current="step"]', 'Writing')
        ->assertSee('Silent writing: your cards are only visible to you until the reveal.')
        ->assertSee('Add a card')
        ->assertSee('Visible only to you')
        ->assertSee('Hidden until the reveal')
        ->assertSee('Next')
        ->assertSee('Share')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $page->click('Share')
        ->assertSeeIn('[role="dialog"]', 'Allow guests without an account')
        ->assertSeeIn('[role="dialog"]', 'Session code')
        ->assertSeeIn('[role="dialog"]', DocsGettingStartedJoinCode)
        ->assertSeeIn('[role="dialog"]', 'Copy the code')
        ->assertSeeIn('[role="dialog"]', 'Regenerate link')
        ->assertPresent('[role="dialog"] [aria-label="Guest link"]')
        ->click('[role="dialog"] button:has-text("Done")')
        ->assertNotPresent('[role="dialog"]');

    $this->docShot($page, 'getting-started/board-writing', '[data-slot="session-frame"]');
});

it('shows the actions phase with the most voted topics and two action items, before the facilitator closes the retro', function () {
    $world = DocsWorld::create();
    [$retro, $participants] = docsGettingStartedRetro($world, RetroPhase::Actions);

    docsGettingStartedVotes($retro, $participants, [
        ['Starting new stories%', 'Théo', 2],
        ['Starting new stories%', 'Inès', 2],
        ['Starting new stories%', 'Malik', 1],
        ['Pair on the code reviews%', 'Sofia', 2],
        ['Pair on the code reviews%', 'Malik', 1],
        ['Write the release notes%', 'Inès', 1],
        ['Mob sessions%', 'Sofia', 1],
    ]);

    $retro->update([
        'highlighted_card_id' => Card::query()->where('retro_id', $retro->id)->where('content', 'like', 'Starting new stories%')->sole()->id,
    ]);

    $actionItems = [
        ['Freeze the sprint scope two days before the end', 'Théo', 'Malik'],
        ['Pair on every checkout pull request', 'Inès', 'Inès'],
    ];

    foreach ($actionItems as [$content, $author, $assignee]) {
        ActionItem::factory()->assignedTo($world->person($assignee))->create([
            'retro_id' => $retro->id,
            'created_by_participant_id' => $participants[$author]->id,
            'content' => $content,
        ]);
    }

    $page = $this->docsVisit($world->person('Théo'), route('retros.show', $retro, false))
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->assertSee('Most voted topics')
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Freeze the sprint scope two days before the end')
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Pair on every checkout pull request')
        ->assertPresent('[data-test="retro-action-items-panel"] [aria-label="Add an action item…"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'getting-started/board-actions', '[data-slot="session-frame"]');

    $page->click('[data-slot="facilitator-dock"] button:has-text("Next phase")')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->click('[data-slot="facilitator-dock"] button:has-text("End session")')
        ->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertPresent('[data-slot="retro-session-end"]')
        ->assertSeeIn('[role="tablist"][aria-label="Retrospective views"]', 'Results')
        ->assertSeeIn('#completed-tab-board', 'Board')
        ->assertSeeIn('[data-slot="retro-session-end"]', 'Freeze the sprint scope two days before the end');
});

it('takes a guest from the session code to the join page, then to the board in the voting phase', function () {
    $world = DocsWorld::create();
    [$retro, $participants] = docsGettingStartedRetro($world, RetroPhase::Voting);

    docsGettingStartedVotes($retro, $participants, [
        ['Starting new stories%', 'Théo', 2],
        ['Pair on the code reviews%', 'Sofia', 2],
        ['Write the release notes%', 'Inès', 1],
    ]);

    Participant::creating(function (Participant $participant): void {
        if ($participant->guest_name !== null) {
            $participant->id = '0199d0c5-0000-7000-8000-000000000301';
        }
    });

    $page = $this->docsOpen(route('joinCodes.create', [], false))
        ->assertPresent('[data-slot="join-code"] #code')
        ->assertSeeIn('[data-slot="join-code"]', 'Join a session')
        ->assertSeeIn('[data-slot="join-code"]', 'Session code')
        ->fill('#code', 'h7kp4m2')
        ->assertValue('#code', DocsGettingStartedJoinCode);

    $this->docShot($page, 'getting-started/join-code', '[data-slot="join-code"]');

    $page->click('[data-slot="join-code"] button[type="submit"]')
        ->assertPathIs('/join/'.DocsGettingStartedGuestToken)
        ->assertPresent('[data-slot="guest-join"] #name')
        ->assertSeeIn('[data-slot="guest-join"] h2', 'Join as a guest')
        ->assertSeeIn('[data-slot="guest-join-session"]', 'Sprint 43 retro')
        ->assertSeeIn('[data-slot="guest-join"] label[for="name"]', 'Your nickname')
        ->assertPresent('[data-slot="guest-join"] [role="radiogroup"][aria-label="Avatar colour"]')
        ->assertSeeIn('[data-slot="guest-join"] button[type="button"]:has-text("Another random nickname")', 'Another random nickname')
        ->fill('#name', 'Priya Nair')
        ->assertSeeIn('[data-slot="guest-join-preview"]', 'Priya Nair');

    $this->docShot($page, 'getting-started/guest-join', '[data-slot="guest-join"]');

    $topic = Card::query()->where('retro_id', $retro->id)->where('content', 'like', 'Starting new stories%')->sole();

    $page->click('Join the session')
        ->assertPathIs("/retros/{$retro->id}")
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertSeeIn('[aria-current="step"]', 'Voting')
        ->assertSee('Votes left: 5')
        ->click("#card-{$topic->id} [aria-label=\"Add a vote\"]")
        ->assertSee('Votes left: 4')
        ->assertNotPresent('[aria-label="Facilitator menu"]')
        ->assertNotPresent('[data-slot="facilitator-dock"]')
        ->assertNotPresent('[data-slot="session-back"]')
        ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

    $this->docShot($page, 'getting-started/guest-on-board', '[data-slot="session-frame"]');
});
