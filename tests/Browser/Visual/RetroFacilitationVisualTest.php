<?php

use App\Enums\ColumnColor;
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
use App\Models\TopicNote;
use App\Models\User;
use App\Models\Vote;
use App\Models\Workspace;
use App\Support\Retros\PhaseDurations;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

const P21People = [
    ['Camille Roux', 'camille@example.com'],
    ['Inès Morel', 'ines@example.com'],
    ['Malik Kader', 'malik@example.com'],
    ['Léa Martin', 'lea@example.com'],
    ['Tom Bernard', 'tom@example.com'],
    ['Sofia Haddad', 'sofia@example.com'],
    ['Hugo Petit', 'hugo@example.com'],
    ['Nora Lambert', 'nora@example.com'],
];

/**
 * The six topics of the board, most voted first: column title, content, votes.
 */
const P21Topics = [
    ['À améliorer', 'Les changements de périmètre arrivent en plein sprint.', 6],
    ['Ce qui a marché', 'La démo client s’est très bien passée, l’onboarding les a convaincus.', 5],
    ['Idées', 'Un créneau sans réunion le jeudi après-midi.', 4],
    ['À améliorer', 'Les revues de code attendent plus de deux jours.', 3],
    ['Ce qui a marché', 'Le binômage sur les revues.', 2],
    ['Merci', 'Merci à Malik pour la mise en production de vendredi.', 1],
];

/**
 * A retro of the Atlas team with `$people` participants, the first one facilitating, and the six topics of
 * P21Topics. Ids are fixed: the avatars are drawn from them.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: list<User>,
 *     2: list<Participant>,
 *     3: list<Card>
 * }
 */
function p21RetroVisualBoard(RetroPhase $phase, int $people, array $attributes = []): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $retro = Retro::factory()->inPhase($phase)->create([
        'id' => '0199b021-0000-7000-8000-000000000001',
        'team_id' => $team->id,
        'title' => 'Rétro du sprint 42 · Atlas',
        'votes_per_participant' => 5,
    ]);

    $users = [];
    $participants = [];

    foreach (array_slice(P21People, 0, $people) as $index => [$name, $email]) {
        $user = User::factory()->create([
            'id' => "0199b021-0000-7000-8000-00000000001{$index}",
            'name' => $name,
            'email' => $email,
            'locale' => 'fr',
        ]);
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);

        $users[] = $user;
        $participants[] = Participant::factory()->create([
            'id' => "0199b021-0000-7000-8000-00000000002{$index}",
            'retro_id' => $retro->id,
            'user_id' => $user->id,
        ]);
    }

    $columns = [];

    foreach ([['Ce qui a marché', ColumnColor::Moss], ['À améliorer', ColumnColor::Coral], ['Idées', ColumnColor::Sun], ['Merci', ColumnColor::Plum]] as $position => [$title, $color]) {
        $columns[$title] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'color' => $color,
            'position' => $position,
        ]);
    }

    $cards = [];

    foreach (P21Topics as $index => [$column, $content, $votes]) {
        $cards[] = $card = Card::factory()->create([
            'retro_id' => $retro->id,
            'column_id' => $columns[$column]->id,
            'participant_id' => $participants[$index % $people]->id,
            'content' => $content,
            'position' => $index,
        ]);

        if ($phase === RetroPhase::Writing) {
            continue;
        }

        foreach (range(1, $votes) as $vote) {
            Vote::factory()->create([
                'retro_id' => $retro->id,
                'card_id' => $card->id,
                'participant_id' => $participants[($index + $vote) % $people]->id,
            ]);
        }
    }

    $retro->forceFill(['facilitator_participant_id' => $participants[0]->id, ...$attributes])->save();

    return [$retro->fresh(), $users, $participants, $cards];
}

/**
 * Signs `$user` in, in a browser context of their own, and opens the board.
 *
 * @param  array<string, string>  $options
 */
function p21OpenBoard(User $user, Retro $retro, array $options = []): mixed
{
    $page = $options === [] ? visit('/login') : visit('/login', $options);

    $page->fill('#email', $user->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate("/retros/{$retro->id}")
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected');
}

/**
 * Opens the composer of the column at `$column` (from 1) and types a card, without sending it: the board announces the writer.
 */
function p21StartWriting(mixed $page, int $column, string $text): mixed
{
    $section = ":nth-match([data-slot=\"retro-column\"], {$column})";

    $page->click("{$section} [data-slot=\"retro-column-add\"]");

    return $page->type("{$section} [data-slot=\"retro-card-composer\"] textarea", $text);
}

/**
 * The tracker answers of an export to Jira: the projects, the issue types, the assignee and the created issue.
 */
function p21FakeJira(): void
{
    Http::fake([
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [
            ['id' => '10000', 'key' => 'ATLAS', 'name' => 'Atlas'],
        ]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([
            ['id' => '10', 'name' => 'Bug', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
        ]),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('5b10ac8d82e05b22cc7d4ef5', 'Inès Morel', 'ines@example.com')]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta()),
        jiraApiUrl('rest/api/3/issue') => Http::response(['id' => '10142', 'key' => 'ATLAS-142', 'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10142'], 201),
    ]);
}

/**
 * The Actions phase with a Jira tracker: the shared topic is the second one, and items are linked to their topics.
 *
 * @return array{
 *     0: Retro,
 *     1: User
 * }
 */
function p21ActionsBoard(): array
{
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);

    [$retro, $users, $participants, $cards] = p21RetroVisualBoard(RetroPhase::Actions, 3);
    $retro->update(['highlighted_card_id' => $cards[1]->id]);

    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $items = [
        ['Geler le périmètre au deuxième jour du sprint', $cards[0], ['assignee_user_id' => $users[1]->id, 'due_on' => '2031-10-14']],
        ['Partager le backlog dans #atlas-produit chaque lundi', $cards[0], []],
        ['Refaire la démo d’onboarding pour l’équipe support', $cards[1], ['assignee_user_id' => $users[2]->id]],
        ['Bloquer le jeudi après-midi dans les agendas', null, []],
    ];

    foreach ($items as $index => [$content, $card, $extra]) {
        ActionItem::factory()->create([
            'retro_id' => $retro->id,
            'created_by_participant_id' => $participants[$index % 3]->id,
            'card_id' => $card?->id,
            'content' => $content,
            ...$extra,
        ]);
    }

    return [$retro->fresh(), $users[0]];
}

beforeEach(function () {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    RateLimiter::for('login', fn (): Limit => Limit::none());
});

it('[P21-20-01] renders the writing board of the facilitator, the timer paused and a member writing, without overflow', function () {
    [$retro, $users] = p21RetroVisualBoard(RetroPhase::Writing, 3, ['timer_paused_seconds' => 272]);
    $ines = p21OpenBoard($users[1], $retro);

    $this->captureVisuals(
        'retro-writing-paused',
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($users, $retro, $ines) {
            $page = p21OpenBoard($users[0], $retro, $options)
                ->assertPresent('[data-slot="timer-pill"][data-state="paused"]');

            p21StartWriting($ines, 2, 'Les tickets arrivent sans critères d’acceptation');

            return $page->assertSeeIn('[data-slot="retro-activity"]', 'Inès écrit une carte…');
        },
    );
});

it('[P21-20-02] renders the writing count of an anonymous retro in the presence line, without overflow', function () {
    [$retro, $users] = p21RetroVisualBoard(RetroPhase::Writing, 4, ['is_anonymous' => true]);
    $writers = array_map(fn (User $user): mixed => p21OpenBoard($user, $retro), array_slice($users, 1));

    $this->captureVisuals(
        'retro-writing-anonymous-count',
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($users, $retro, $writers) {
            $page = p21OpenBoard($users[0], $retro, $options);

            foreach ($writers as $index => $writer) {
                p21StartWriting($writer, $index + 1, 'Une carte en cours d’écriture');
            }

            return $page->assertSeeIn('[data-slot="presence-stack-typing"]', '3 personnes écrivent…')
                ->assertNotPresent('[data-slot="retro-activity"]');
        },
    );
});

it('[P21-20-03] renders the voting board of a participant at the cap of a card, 5 of 8 finished, without overflow', function () {
    [$retro, $users, $participants, $cards] = p21RetroVisualBoard(RetroPhase::Voting, 8, ['max_votes_per_card' => 2]);

    Vote::query()->where('participant_id', $participants[1]->id)->delete();
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $cards[0]->id, 'participant_id' => $participants[1]->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $cards[2]->id, 'participant_id' => $participants[1]->id]);

    Participant::query()->whereKey(array_map(fn (Participant $participant): string => $participant->id, [$participants[1], $participants[2], $participants[3], $participants[5], $participants[6]]))
        ->update(['voting_finished_at' => now()]);

    foreach ([0, 2, 3, 4, 5, 6, 7] as $index) {
        p21OpenBoard($users[$index], $retro);
    }

    $this->captureVisuals(
        'retro-voting-cap-finished',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p21OpenBoard($users[1], $retro, $options)
            ->assertSeeIn('[data-slot="retro-finished-count"]', '5/8 ont terminé')
            ->assertSee('Modifier mes votes'),
    );
});

it('[P21-20-04] renders the discussion of the facilitator, the topic timer, the notes and the topic actions, without overflow', function () {
    [$retro, $users, $participants, $cards] = p21RetroVisualBoard(RetroPhase::Discussing, 3);

    $retro->update([
        'topic_seconds' => 300,
        'highlighted_card_id' => $cards[1]->id,
        'timer_ends_at' => now()->addSeconds(192)->startOfSecond(),
    ]);
    $cards[0]->update(['discussed_at' => now()->subMinutes(4)]);

    $items = [
        ['Geler le périmètre au deuxième jour du sprint', $cards[0]],
        ['Partager le backlog dans #atlas-produit chaque lundi', $cards[0]],
        ['Refaire la démo d’onboarding pour l’équipe support', $cards[1]],
    ];

    foreach ($items as $index => [$content, $card]) {
        ActionItem::factory()->create([
            'retro_id' => $retro->id,
            'created_by_participant_id' => $participants[$index % 3]->id,
            'card_id' => $card->id,
            'content' => $content,
        ]);
    }

    TopicNote::factory()->create([
        'retro_id' => $retro->id,
        'card_id' => $cards[1]->id,
        'body' => "Le client a validé le parcours sans changement.\nL’onboarding guidé a fait la différence : à garder pour la prochaine démo.",
        'updated_by_participant_id' => $participants[1]->id,
    ]);

    $this->captureVisuals(
        'retro-discussing-topic-timer',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p21OpenBoard($users[0], $retro, $options)
            ->assertPresent('[data-slot="retro-topic-timer"]')
            ->assertPresent('[data-slot="retro-topic-notes"] textarea')
            ->assertPresent('[data-slot="retro-topic-meta"][data-state="discussed"]')
            ->assertSee('Actions du sujet'),
    );
});

it('[P21-20-05] renders the actions of the facilitator, linked to their topics, with the export to Jira, without overflow', function () {
    p21FakeJira();

    [$retro, $facilitator] = p21ActionsBoard();

    $this->captureVisuals(
        'retro-actions-linked',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p21OpenBoard($facilitator, $retro, $options)
            ->assertSeeIn('[data-slot="retro-bulk-export-button"]', 'Exporter vers Jira')
            ->assertPresent('[data-slot="retro-item-topic"]'),
    );
});

it('[P21-20-06] renders the bulk export to Jira mid-run, one exported, one running, one pending, without overflow', function () {
    p21FakeJira();

    [$retro, $facilitator] = p21ActionsBoard();

    $holdSecondExport = <<<'JS'
        () => {
            const isExport = (method, url) => String(method).toUpperCase() === 'POST' && /\/action-items\/[^/?]+\/exports$/.test(String(url));
            let exports = 0;
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                this.holdsExport = isExport(method, url);

                return open.call(this, method, url, ...rest);
            };
            XMLHttpRequest.prototype.send = function (...args) {
                if (this.holdsExport && ++exports > 1) {
                    return undefined;
                }

                return send.apply(this, args);
            };
            const fetchOnce = window.fetch.bind(window);
            window.fetch = (input, init = {}) => {
                const url = typeof input === 'string' ? input : input.url;

                if (isExport(init.method ?? 'GET', url) && ++exports > 1) {
                    return new Promise(() => {});
                }

                return fetchOnce(input, init);
            };

            return true;
        }
        JS;

    $this->captureVisuals(
        'retro-actions-bulk-export',
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($facilitator, $retro, $holdSecondExport) {
            $dialog = '[data-slot="retro-bulk-export"]';
            $page = p21OpenBoard($facilitator, $retro, $options)
                ->click('[data-slot="retro-bulk-export-button"]')
                ->assertCount("{$dialog} [data-slot=\"bulk-export-items\"] [data-item-id]", 4)
                ->assertScript("document.querySelector('{$dialog} [data-slot=\"bulk-export-items\"] [data-item-id]:last-child button[role=\"checkbox\"]') !== null", true);

            $page->click("{$dialog} [data-slot=\"bulk-export-items\"] [data-item-id]:last-child button[role=\"checkbox\"]");
            $page->script($holdSecondExport);
            $page->click('Exporter 3 actions');

            return $page->assertPresent("{$dialog} [data-item-id][data-state=\"exported\"]")
                ->assertPresent("{$dialog} [data-item-id][data-state=\"running\"]")
                ->assertPresent("{$dialog} [data-item-id][data-state=\"pending\"]");
        },
    );
});

it('[P21-20-07] renders the ROTI of the facilitator before the reveal, two votes awaited, without overflow', function () {
    [$retro, $users, $participants] = p21RetroVisualBoard(RetroPhase::Roti, 4);

    foreach ([[0, 4], [1, 5]] as [$index, $score]) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participants[$index]->id, 'score' => $score]);
    }

    foreach ([1, 2, 3] as $index) {
        p21OpenBoard($users[$index], $retro);
    }

    $this->captureVisuals(
        'retro-roti-before-reveal',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p21OpenBoard($users[0], $retro, $options)
            ->assertSee('Relancer les 2 derniers')
            ->assertSee('Révéler le ROTI'),
    );
});

it('[P21-20-08] renders the ROTI of a participant after the reveal, without overflow', function () {
    [$retro, $users, $participants] = p21RetroVisualBoard(RetroPhase::Roti, 5, ['roti_revealed_at' => now()->subMinute()]);

    foreach ([[0, 4], [1, 5], [2, 3], [3, 4]] as [$index, $score]) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participants[$index]->id, 'score' => $score]);
    }

    $this->captureVisuals(
        'retro-roti-revealed',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p21OpenBoard($users[1], $retro, $options)
            ->assertPresent('[data-slot="retro-roti-widget"]')
            ->assertDontSee('Révéler le ROTI'),
    );
});

it('[P21-20-09] renders the retro form of the new session dialog with a cap of 2 votes per card, without overflow', function () {
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199b021-0000-7000-8000-000000000011',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
        'locale' => 'fr',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    $this->captureVisuals(
        'session-create-max-per-card',
        route('teams.show', [$workspace, $team, 'new' => 'retro'], false),
        function (string $path, array $options) use ($admin) {
            $page = visit('/login', $options);

            $page->fill('#email', $admin->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            return $page->navigate($path)
                ->assertPresent('[role="dialog"] [data-slot="retro-session-fields"] [data-slot="template-shortcut"]')
                ->click('[role="dialog"] #new-retro-max-votes-per-card-auto')
                ->assertAttribute('[role="dialog"] #new-retro-max-votes-per-card-auto', 'aria-checked', 'false')
                ->assertSeeIn('[role="dialog"] [data-slot="stepper"][aria-label="Max par carte"] output', '2');
        },
    );
});

it('[P22-20-05] renders the phase timer offered to the facilitator of a writing board, its menu open, without overflow', function () {
    [$retro, $users] = p21RetroVisualBoard(RetroPhase::Writing, 3, ['phase_durations' => PhaseDurations::Standard]);

    $this->captureVisuals(
        'retro-phase-timer-offer',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p21OpenBoard($users[0], $retro, $options)
            ->assertSeeIn('[data-slot="timer-suggestion"]', '7 min')
            ->assertAttribute('[data-slot="timer-suggestion"]', 'aria-label', 'Lancer le timer de la phase Écriture, 7 minutes')
            ->click('button[aria-label="Minuteur"]')
            ->assertSeeIn('[role="menu"] [role="menuitem"]:first-child', 'Écriture · 7 min'),
    );
});
