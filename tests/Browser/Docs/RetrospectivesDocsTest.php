<?php

use App\Enums\ActionItemPriority;
use App\Enums\ColumnColor;
use App\Enums\GameKind;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Enums\TemplateCategory;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\RotiVote;
use App\Models\SuggestedAction;
use App\Models\TeamIntegration;
use App\Models\TopicNote;
use App\Models\Vote;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use App\Support\Retros\PhaseDurations;
use Tests\Browser\Support\DocsWorld;

const DocsRetroId = '0199d0c5-0001-7000-8000-000000000001';

const DocsRetroCards = [
    ['Start', 'Inès', 'Pair on code reviews for the payment service', null],
    ['Start', 'Lucas', 'Review pull requests within a day', 'Pair on code reviews for the payment service'],
    ['Start', 'Malik', 'Write acceptance criteria before a ticket enters the sprint', null],
    ['Stop', 'Noa', 'Scope changes arriving in the middle of the sprint', null],
    ['Stop', 'Sofia', 'Tickets added after sprint planning', 'Scope changes arriving in the middle of the sprint'],
    ['Stop', 'Malik', 'Deploying on Friday afternoon', null],
    ['Continue', 'Camille', 'The client demo: the new onboarding convinced them', null],
    ['Continue', 'Inès', 'Thursday afternoon without meetings', null],
];

const DocsRetroVotes = [
    'Scope changes arriving in the middle of the sprint' => ['Théo' => 2, 'Camille' => 1, 'Inès' => 1, 'Malik' => 1, 'Sofia' => 1],
    'Pair on code reviews for the payment service' => ['Inès' => 2, 'Lucas' => 2, 'Noa' => 1],
    'Deploying on Friday afternoon' => ['Malik' => 2, 'Camille' => 1, 'Noa' => 1],
    'Write acceptance criteria before a ticket enters the sprint' => ['Sofia' => 2, 'Théo' => 1],
    'The client demo: the new onboarding convinced them' => ['Camille' => 1, 'Lucas' => 1],
    'Thursday afternoon without meetings' => ['Sofia' => 1],
];

function docsRetroReached(RetroPhase $phase, RetroPhase $step): bool
{
    return array_search($phase, RetroPhase::cases(), true) >= array_search($step, RetroPhase::cases(), true);
}

function docsRetroParticipant(Retro $retro, DocsWorld $world, string $firstName): Participant
{
    return Participant::query()->where('retro_id', $retro->id)->where('user_id', $world->person($firstName)->id)->sole();
}

function docsRetroCard(Retro $retro, string $content): Card
{
    return Card::query()->where('retro_id', $retro->id)->where('content', $content)->sole();
}

function docsRetroColumn(Retro $retro, string $title): Column
{
    return Column::query()->where('retro_id', $retro->id)->where('title', $title)->sole();
}

function docsRetro(DocsWorld $world, RetroPhase $phase): Retro
{
    $heldOn = now()->startOfWeek()->subDays(10)->setTime(10, 0);

    $retro = Retro::factory()->inPhase($phase)->started($heldOn)->create([
        'id' => DocsRetroId,
        'team_id' => $world->team->id,
        'title' => 'Sprint 42 retrospective',
        'template' => 'start_stop_continue',
        'votes_per_participant' => 5,
        'ai_summary_enabled' => true,
        'created_at' => $heldOn,
    ]);

    foreach (['Théo', 'Camille', 'Inès', 'Malik', 'Sofia', 'Noa', 'Lucas'] as $index => $firstName) {
        Participant::factory()->create([
            'id' => sprintf('0199d0c5-0002-7000-8000-%012d', $index + 1),
            'retro_id' => $retro->id,
            'user_id' => $world->person($firstName)->id,
        ]);
    }

    $retro->forceFill(['facilitator_participant_id' => docsRetroParticipant($retro, $world, 'Théo')->id])->save();

    $columns = [
        ['Start', ColumnColor::Moss],
        ['Stop', ColumnColor::Coral],
        ['Continue', ColumnColor::Sky],
    ];

    foreach ($columns as $position => [$title, $color]) {
        Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'description' => __('templates.start_stop_continue.columns')[$position]['description'],
            'color' => $color,
            'position' => $position,
        ]);
    }

    if ($phase === RetroPhase::Icebreaker) {
        return $retro->fresh();
    }

    $isGrouped = docsRetroReached($phase, RetroPhase::Grouping);

    foreach (DocsRetroCards as $position => [$column, $author, $content, $groupedUnder]) {
        Card::factory()->create([
            'retro_id' => $retro->id,
            'column_id' => docsRetroColumn($retro, $column)->id,
            'participant_id' => docsRetroParticipant($retro, $world, $author)->id,
            'parent_card_id' => $isGrouped && $groupedUnder !== null ? docsRetroCard($retro, $groupedUnder)->id : null,
            'content' => $content,
            'position' => $position,
        ]);
    }

    if ($isGrouped) {
        docsRetroCard($retro, 'Scope changes arriving in the middle of the sprint')->update(['group_name' => 'Scope creep']);
    }

    if (docsRetroReached($phase, RetroPhase::Voting)) {
        foreach (DocsRetroVotes as $content => $voters) {
            foreach ($voters as $firstName => $count) {
                Vote::factory()->count($count)->create([
                    'retro_id' => $retro->id,
                    'card_id' => docsRetroCard($retro, $content)->id,
                    'participant_id' => docsRetroParticipant($retro, $world, $firstName)->id,
                ]);
            }
        }
    }

    if (docsRetroReached($phase, RetroPhase::Discussing)) {
        docsRetroDiscussion($world, $retro);
    }

    if (docsRetroReached($phase, RetroPhase::Actions)) {
        docsRetroActionItems($world, $retro);
    }

    if (docsRetroReached($phase, RetroPhase::Roti)) {
        foreach (['Théo' => 4, 'Camille' => 5, 'Inès' => 4, 'Malik' => 3, 'Sofia' => 5] as $firstName => $score) {
            RotiVote::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => docsRetroParticipant($retro, $world, $firstName)->id,
                'score' => $score,
            ]);
        }
    }

    if ($phase === RetroPhase::Completed) {
        foreach (['Noa' => 4, 'Lucas' => 4] as $firstName => $score) {
            RotiVote::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => docsRetroParticipant($retro, $world, $firstName)->id,
                'score' => $score,
            ]);
        }

        $retro->forceFill([
            'highlighted_card_id' => null,
            'roti_revealed_at' => $heldOn->copy()->addMinutes(52),
            'completed_at' => $heldOn->copy()->addMinutes(55),
        ])->save();
    }

    return $retro->fresh();
}

function docsRetroDiscussion(DocsWorld $world, Retro $retro): void
{
    $topic = docsRetroCard($retro, 'Scope changes arriving in the middle of the sprint');

    $retro->forceFill(['highlighted_card_id' => $topic->id])->save();

    $comments = [
        ['Camille', 'Two of the three changes came from the same client request.'],
        ['Malik', 'Could we take changes only until the refinement on Wednesday?'],
    ];

    foreach ($comments as [$firstName, $content]) {
        CardComment::factory()->create([
            'retro_id' => $retro->id,
            'card_id' => $topic->id,
            'participant_id' => docsRetroParticipant($retro, $world, $firstName)->id,
            'content' => $content,
        ]);
    }

    foreach (['Inès' => '👍', 'Malik' => '👍', 'Lucas' => '👍', 'Sofia' => '🎯'] as $firstName => $emoji) {
        CardReaction::factory()->create([
            'retro_id' => $retro->id,
            'card_id' => $topic->id,
            'participant_id' => docsRetroParticipant($retro, $world, $firstName)->id,
            'emoji' => $emoji,
        ]);
    }

    TopicNote::factory()->create([
        'retro_id' => $retro->id,
        'card_id' => $topic->id,
        'body' => "The late changes came from two clients.\nProposal: a cut-off on day two, later requests wait for the next sprint.",
        'updated_by_participant_id' => docsRetroParticipant($retro, $world, 'Théo')->id,
    ]);
}

function docsRetroActionItems(DocsWorld $world, Retro $retro): void
{
    $items = [
        ['Agree on a change cut-off with both clients: day two of the sprint', 'Scope changes arriving in the middle of the sprint', 'Camille', ActionItemPriority::High],
        ['Post the pull requests waiting for a review in the team channel every morning', 'Pair on code reviews for the payment service', 'Lucas', ActionItemPriority::Medium],
    ];

    foreach ($items as [$content, $topic, $owner, $priority]) {
        ActionItem::factory()->create([
            'retro_id' => $retro->id,
            'created_by_participant_id' => docsRetroParticipant($retro, $world, 'Théo')->id,
            'card_id' => docsRetroCard($retro, $topic)->id,
            'content' => $content,
            'assignee_user_id' => $world->person($owner)->id,
            'due_on' => now()->startOfWeek()->addDays(11)->toDateString(),
            'priority' => $priority,
        ]);
    }
}

function docsRetroSummary(Retro $retro): void
{
    $retro->forceFill([
        'summary' => 'The sprint ended on a client demo that convinced, and the team wants to keep its Thursday afternoon without meetings. Two things slowed it down: scope changes that arrived after planning, and pull requests that waited more than two days for a review. The team agreed on a cut-off for changes and on a daily reminder for reviews.',
        'summary_status' => SummaryStatus::Ready,
        'summary_requested_at' => $retro->completed_at,
        'summary_generated_at' => $retro->completed_at,
    ])->save();

    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Late scope changes']);
    $cards = [
        ['Scope changes arriving in the middle of the sprint', 'Planning'],
        ['Tickets added after sprint planning', 'Planning'],
    ];

    foreach ($cards as [$content, $category]) {
        $card = docsRetroCard($retro, $content);
        $card->forceFill(['sentiment' => 'negative', 'category' => $category])->save();
        $theme->cards()->attach($card->id);
    }

    foreach (['Ask clients to send change requests before the refinement', 'Show the sprint scope on the team page of the wiki'] as $position => $content) {
        SuggestedAction::factory()->create([
            'retro_id' => $retro->id,
            'theme_id' => $position === 0 ? $theme->id : null,
            'content' => $content,
            'position' => $position,
        ]);
    }
}

function docsRetroPath(Retro $retro): string
{
    return route('retros.show', $retro, false);
}

function docsRetroBoard(mixed $page): mixed
{
    return $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->assertNotPresent('[data-slot="person-avatar"] .animate-pulse');
}

it('shows the new session dialog of the team page on the retrospective, then every template', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team, 'new' => 'retro'], false))
        ->assertPresent('[data-dialog="new-session"] [data-slot="template-shortcut"]');

    $this->docShot($page, 'retrospectives/new-retro', '[data-dialog="new-session"]');

    $page->click('[data-dialog="new-session"] button:has-text("All templates")')
        ->assertPresent('[data-slot="retro-template-picker"] [data-slot="template-card"]');

    $this->docShot($page, 'retrospectives/template-picker', '[data-slot="retro-template-picker"]');
});

it('shows the phases of the header as the facilitator moves through them', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Grouping);

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->assertPresent('[data-slot="phase-stepper"] [data-slot="phase-forward"]');

    $this->docShot($page, 'retrospectives/phase-bar', '[data-slot="phase-stepper"]');
});

it('shows a column in the writing phase, where the cards of the others stay hidden, and a card being written', function () {
    fakeVisualGifs();

    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Writing);
    $start = '[data-test="retro-column-'.docsRetroColumn($retro, 'Start')->id.'"]';
    $continue = '[data-test="retro-column-'.docsRetroColumn($retro, 'Continue')->id.'"]';

    $page = docsRetroBoard($this->docsVisit($world->person('Inès'), docsRetroPath($retro)))
        ->assertSeeIn($start, 'Pair on code reviews for the payment service')
        ->assertCount("{$start} [data-slot=\"retro-card\"]", 3);

    $this->docShot($page, 'retrospectives/writing-column', $start);

    $page->click("{$continue} [data-slot=\"retro-column-add\"]")
        ->type("{$continue} [data-slot=\"retro-card-composer\"] textarea", 'Mob programming on the hardest ticket of the sprint')
        ->assertPresent("{$continue} [data-slot=\"retro-card-composer\"] button:has-text(\"GIF\")");

    $this->docShot($page, 'retrospectives/card-composer', "{$continue} [data-slot=\"retro-card-composer\"]");
});

it('shows a named group of two cards in the grouping phase', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Grouping);
    $group = '#group-'.docsRetroCard($retro, 'Scope changes arriving in the middle of the sprint')->id;

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->assertSeeIn($group, 'Scope creep')
        ->assertSeeIn($group, 'Tickets added after sprint planning');

    $this->docShot($page, 'retrospectives/group', $group);
});

it('shows the votes a participant has left and a column with their votes in the voting phase', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Voting);
    $start = '[data-test="retro-column-'.docsRetroColumn($retro, 'Start')->id.'"]';

    $page = docsRetroBoard($this->docsVisit($world->person('Inès'), docsRetroPath($retro)))
        ->assertPresent('[data-slot="retro-voting-bar"] [data-slot="retro-finished-count"]')
        ->assertPresent("{$start} [data-slot=\"card-group-votes\"]");

    $this->docShot($page, 'retrospectives/votes-left', '[data-slot="retro-voting-bar"] [data-slot="vote-budget"]');
    $this->docShot($page, 'retrospectives/voting-column', $start);
});

it('shows the icebreaker of a retro before the first round', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Icebreaker);
    $retro->forceFill(['icebreaker_enabled' => true, 'icebreaker_game' => GameKind::Hangman])->save();

    $room = GameRoom::factory()->icebreaker($retro)->game(GameKind::Hangman)->create(['id' => '0199d0c5-0003-7000-8000-000000000001']);

    foreach ($retro->participants()->orderBy('id')->get() as $participant) {
        GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
    }

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro))->resize(1440, 1240))
        ->assertPresent('[data-slot="icebreaker-stage"] section');

    $this->docShot($page, 'retrospectives/icebreaker', '[data-slot="icebreaker-stage"]');
});

it('shows the name a language model suggests for a group', function () {
    configureLlm();
    fakeLlmReply([['index' => 1, 'name' => 'Faster code reviews']]);

    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Grouping);
    $group = '#group-'.docsRetroCard($retro, 'Pair on code reviews for the payment service')->id;

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->click('Suggest group names')
        ->assertSeeIn("{$group} [data-slot=\"retro-group-suggested-name\"]", 'Faster code reviews');

    $this->docShot($page, 'retrospectives/group-name-suggestion', $group);
});

it('shows the bar of the facilitator in the voting phase, the totals hidden', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Voting);
    $retro->forceFill(['hide_vote_counts' => true])->save();

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->assertSeeIn('[data-slot="facilitator-bar"]', 'Reveal the votes');

    $this->docShot($page, 'retrospectives/voting-facilitator-bar', '[data-slot="facilitator-bar"]');
});

it('shows the topic everyone looks at in the discussion, then the comments of its card', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Discussing);
    $card = '#card-'.docsRetroCard($retro, 'Scope changes arriving in the middle of the sprint')->id;

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->assertPresent('[data-slot="retro-discussion"] [data-slot="retro-topic-focus"]')
        ->assertSeeIn('[data-slot="retro-topic-notes-state"]', 'Saved');

    $this->docShot($page, 'retrospectives/discussion-highlight', '[data-slot="retro-discussion"]');

    $page->click("{$card} [data-slot=\"retro-card-comments\"]")
        ->assertCount("{$card} [data-slot=\"comment\"]", 2);

    $this->docShot($page, 'retrospectives/card-comments', $card);
});

it('shows the action items of the retro in the actions phase', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Actions);

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Agree on a change cut-off');

    $this->docShot($page, 'retrospectives/actions-panel', '[data-test="retro-action-items-panel"]');
});

it('shows the ROTI vote of a participant, what the facilitator sees meanwhile, then the revealed result', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Roti);

    foreach (['Camille', 'Malik', 'Lucas'] as $firstName) {
        docsRetroBoard($this->docsVisit($world->person($firstName), docsRetroPath($retro)));
    }

    $ines = docsRetroBoard($this->docsVisit($world->person('Inès'), docsRetroPath($retro)));
    $noa = docsRetroBoard($this->docsVisit($world->person('Noa'), docsRetroPath($retro)))
        ->assertPresent('[data-slot="retro-roti-widget"] [data-slot="roti-options"]');

    $this->docShot($noa, 'retrospectives/roti-vote', '[data-slot="retro-roti-widget"]');

    $theo = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro)))
        ->assertSeeIn('[data-slot="retro-roti-count"]', '4/6')
        ->assertSeeIn('[data-slot="facilitator-bar"]', 'Nudge the last 2');

    $this->docShot($theo, 'retrospectives/roti-voters', '[data-slot="retro-roti-voters"]');
    $this->docShot($theo, 'retrospectives/roti-facilitator-bar', '[data-slot="facilitator-bar"]');

    $retro->forceFill(['roti_revealed_at' => now()])->save();

    $ines = docsRetroBoard($ines->navigate(docsRetroPath($retro)))
        ->assertPresent('[data-slot="retro-roti-widget"] [data-slot="roti-mean"]');

    $this->docShot($ines, 'retrospectives/roti-results', '[data-slot="retro-roti-widget"]');
});

it('shows a completed retro to a participant', function () {
    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Completed);

    $page = docsRetroBoard($this->docsVisit($world->person('Inès'), docsRetroPath($retro))->resize(1440, 1060))
        ->assertPresent('[data-slot="retro-session-end-stats"]');

    $this->docShot($page, 'retrospectives/session-ended', '[data-slot="retro-session-end"]');
});

it('shows the summary of a completed retro with its suggested actions, and the dialog that mails the results', function () {
    configureLlm();
    config(['mail.default' => 'smtp']);

    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Completed);
    docsRetroSummary($retro);

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro))->resize(1440, 1900))
        ->assertSeeIn('section[aria-labelledby="results-summary"]', 'Suggested actions');

    $this->docShot($page, 'retrospectives/summary', 'section[aria-labelledby="results-summary"]');

    $page->click('Send the recap by email')
        ->assertSeeIn('[role="dialog"]', 'Email the results');

    $this->docShot($page, 'retrospectives/send-results', '[role="dialog"]');
});

it('shows the timer, the settings, the menu and the share dialog of the facilitator', function () {
    enableIntegrations(IntegrationProvider::Slack);

    $world = DocsWorld::create();
    $retro = docsRetro($world, RetroPhase::Writing);
    $retro->forceFill(['timer_paused_seconds' => 272, 'phase_durations' => PhaseDurations::Standard])->save();

    $slack = TeamIntegration::factory()->slack()->create(['team_id' => $world->team->id]);
    $slack->forceFill(['settings' => [...$slack->settings, 'teamName' => 'Nordlys', 'channelName' => '#atlas']])->save();

    $page = docsRetroBoard($this->docsVisit($world->person('Théo'), docsRetroPath($retro))->resize(1440, 1300))
        ->assertPresent('[data-slot="timer-pill"][data-state="paused"]');

    $this->docShot($page, 'retrospectives/timer', '[data-slot="timer"]');

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSeeIn('[role="menu"]', 'Hand over facilitation…');

    $this->docShot($page, 'retrospectives/facilitator-menu', '[role="menu"]');

    $page->click('Settings…')
        ->assertSeeIn('[role="dialog"]', 'Retrospective settings')
        ->assertNotPresent('[role="menu"]');

    $this->docShot($page, 'retrospectives/session-settings', '[role="dialog"]');

    $page = docsRetroBoard($page->navigate(docsRetroPath($retro)))
        ->click('header button:has-text("Share")')
        ->assertPresent('[data-slot="share-dialog"]');

    $this->docShot($page, 'retrospectives/share-dialog', '[data-slot="share-dialog"]');
});

it('shows the templates of the workspace and the editor of one of them', function () {
    $world = DocsWorld::create();

    $templates = [
        ['Release review', TemplateCategory::Essentials, 'Camille', [['Went smoothly', ColumnColor::Moss], ['Got in the way', ColumnColor::Coral], ['For the next release', ColumnColor::Sky]]],
        ['Incident review', TemplateCategory::Analysis, 'Théo', [['What happened', ColumnColor::Sky], ['What helped', ColumnColor::Moss], ['What we change', ColumnColor::Sun], ['Thanks', ColumnColor::Plum]]],
    ];

    foreach ($templates as $index => [$name, $category, $author, $columns]) {
        $template = WorkspaceTemplate::factory()->create([
            'id' => sprintf('0199d0c5-0004-7000-8000-%012d', $index + 1),
            'workspace_id' => $world->workspace->id,
            'name' => $name,
            'category' => $category,
            'created_by_user_id' => $world->person($author)->id,
        ]);

        foreach ($columns as $position => [$title, $color]) {
            WorkspaceTemplateColumn::factory()->create([
                'workspace_template_id' => $template->id,
                'title' => $title,
                'description' => null,
                'color' => $color,
                'position' => $position,
            ]);
        }
    }

    $page = $this->docsVisit($world->person('Camille'), route('workspaces.templates.index', $world->workspace, false))
        ->resize(1440, 1300)
        ->click('[data-slot="templates-tabs"] [role="tab"]:has-text("Retro")')
        ->click('[data-slot="retro-template-picker"] [role="tab"]:has-text("My workspace")')
        ->assertSeeIn('[data-slot="retro-template-picker"]', 'Incident review')
        ->click('[data-slot="retro-template-picker"] [data-slot="template-card"]:has-text("Release review")')
        ->assertSeeIn('[data-slot="template-detail"]', 'For the next release');

    $this->docShot($page, 'retrospectives/templates-page', '[data-slot="workspace-templates-page"]');

    $page->click('[data-slot="template-detail"] button:has(span:text-is("Edit"))')
        ->assertPresent('[data-slot="template-editor"] [data-slot="template-column-row"]');

    $this->docShot($page, 'retrospectives/template-editor', '[data-slot="template-editor"]');
});

it('shows the retrospectives settings of the team', function () {
    $world = DocsWorld::create();

    $world->team->update(['facilitator_rotation_enabled' => true, 'default_retro_template' => 'start_stop_continue']);
    $world->team->defaultFacilitators()->attach([
        $world->person('Théo')->id => ['position' => 0],
        $world->person('Camille')->id => ['position' => 1],
    ]);

    $page = $this->docsVisit($world->person('Camille'), route('teams.retroSettings.show', [$world->workspace, $world->team], false))
        ->resize(1440, 1300)
        ->assertCount('[data-slot="facilitator-chip"]', 2)
        ->assertNotPresent('[data-slot="person-avatar"] .animate-pulse');

    $this->docShot($page, 'retrospectives/retro-settings', '[data-slot="team-settings-shell"]');
});
