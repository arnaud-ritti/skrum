<?php

use App\Enums\ActionItemPriority;
use App\Enums\ColumnColor;
use App\Enums\GameKind;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Survey;
use App\Models\SurveyComment;
use App\Models\SurveyResponse;
use App\Models\SurveyTextAnswer;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;
use App\Models\Vote;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Browser\Support\CaptureFile;

function p18eRetroVisualRetro(): Retro
{
    $retro = Retro::factory()->withGuestAccess()->create([
        'title' => 'Sprint 42 retro · Atlas team',
        'guest_token' => 'visual-guest-token-of-the-retro-pages-01',
    ]);

    [$facilitator] = retroFacilitator($retro);
    retroMember($retro);
    retroMember($retro);

    $facilitator->update(['name' => 'Fran Facilitator']);

    return $retro->fresh();
}

it('[P18e-R2-01] renders the guest join, the invalid guest link and the ended session without overflow', function (string $name, string $path, string $marker) {
    $retro = p18eRetroVisualRetro();

    $this->captureVisuals(
        $name,
        str_replace('{retro}', $retro->id, $path),
        function (string $path, array $options) use ($name, $marker) {
            $page = visit($path, $options)->assertPresent($marker);

            return $name === 'retro-join' ? $page->fill('#name', 'Nadia') : $page;
        },
    );
})->with([
    'guest join' => ['retro-join', '/join/visual-guest-token-of-the-retro-pages-01', '[data-slot="guest-join"] #name'],
    'invalid guest link' => ['retro-join-invalid', '/join/a-guest-token-that-does-not-exist', '[data-slot="access-notice"]'],
    'session ended' => ['retro-session-ended', '/retros/{retro}', '[data-slot="access-notice"] a'],
]);

/**
 * A board in Writing with a facilitator, a member and their cards. Ids are fixed: the avatars are drawn from them.
 *
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User
 * }
 */
function p18eRetroVisualBoard(RetroPhase $phase, bool $icebreakerRound = false): array
{
    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create([
        'id' => '0199b000-0000-7000-8000-000000000001',
        'team_id' => $team->id,
        'title' => 'Sprint 42 retro · Atlas team',
        'votes_per_participant' => 5,
        'completed_at' => $phase === RetroPhase::Completed ? '2026-10-02 10:00:00' : null,
    ]);

    $people = [];

    foreach ([['Fran Facilitator', 'fran@example.com'], ['Maximilian Alexander von Hohenberg-Lichtenstein', 'max@example.com']] as $index => [$name, $email]) {
        $user = User::factory()->create([
            'id' => '0199b000-0000-7000-8000-00000000001'.$index,
            'name' => $name,
            'email' => $email,
        ]);
        $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($user);

        $people[] = [$user, Participant::factory()->create([
            'id' => '0199b000-0000-7000-8000-00000000002'.$index,
            'retro_id' => $retro->id,
            'user_id' => $user->id,
        ])];
    }

    $retro->forceFill(['facilitator_participant_id' => $people[0][1]->id])->save();

    $columns = [
        ['Went well', ColumnColor::Moss, ['The client demo went really well, the onboarding convinced them.', 'Pairing on reviews']],
        ['To improve', ColumnColor::Coral, ['We discover scope changes in the middle of the sprint.']],
        ['Ideas', ColumnColor::Sun, ['A “no meeting” slot on Thursday afternoon.']],
        ['Thanks', ColumnColor::Plum, []],
    ];

    foreach ($columns as $position => [$title, $color, $cards]) {
        $column = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'color' => $color,
            'position' => $position,
        ]);

        foreach ($cards as $cardPosition => $content) {
            Card::factory()->create([
                'retro_id' => $retro->id,
                'column_id' => $column->id,
                'participant_id' => $people[$cardPosition % 2][1]->id,
                'content' => $content,
                'position' => $cardPosition,
            ]);
        }
    }

    if (in_array($phase, [RetroPhase::Grouping, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Completed], true)) {
        $groups = [
            ['Went well', 'Client demo', 'The client signed off the flow without a single change.'],
            ['To improve', null, 'Requirements keep moving while we build.'],
        ];

        foreach ($groups as [$title, $name, $content]) {
            $column = Column::query()->where('retro_id', $retro->id)->where('title', $title)->sole();
            $lead = Card::query()->where('column_id', $column->id)->where('position', 0)->sole();
            $lead->update(['group_name' => $name]);

            Card::factory()->create([
                'retro_id' => $retro->id,
                'column_id' => $column->id,
                'participant_id' => $people[1][1]->id,
                'parent_card_id' => $lead->id,
                'content' => $content,
                'position' => 0,
            ]);
        }

        $idea = Card::query()->where('retro_id', $retro->id)->where('content', 'like', 'A “no meeting”%')->sole();

        foreach ([[$people[0][1], '🎉'], [$people[1][1], '🎉'], [$people[1][1], '👍']] as [$participant, $emoji]) {
            CardReaction::factory()->create([
                'retro_id' => $retro->id,
                'card_id' => $idea->id,
                'participant_id' => $participant->id,
                'emoji' => $emoji,
            ]);
        }

        CardComment::factory()->create([
            'retro_id' => $retro->id,
            'card_id' => $idea->id,
            'participant_id' => $people[1][1]->id,
            'content' => 'Thursday is the day of the sprint review, Wednesday would be easier.',
        ]);
    }

    if (in_array($phase, [RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Actions, RetroPhase::Completed], true)) {
        $votes = [
            ['The client demo%', $people[0][1], 1],
            ['We discover scope changes%', $people[0][1], 2],
            ['We discover scope changes%', $people[1][1], 1],
            ['A “no meeting”%', $people[1][1], 2],
        ];

        foreach ($votes as [$content, $participant, $count]) {
            $card = Card::query()->where('retro_id', $retro->id)->where('content', 'like', $content)->sole();

            Vote::factory()->count($count)->create([
                'retro_id' => $retro->id,
                'card_id' => $card->id,
                'participant_id' => $participant->id,
            ]);
        }
    }

    if ($phase->showsTopics() || $phase === RetroPhase::Completed) {
        $actionItems = [
            ['Share the sprint backlog in #atlas-product every Monday', $people[0], ['assignee_user_id' => $people[1][0]->id, 'due_on' => '2031-10-14']],
            ['Apply a “one in, one out” rule to mid-sprint additions', $people[1], ['priority' => ActionItemPriority::High]],
        ];

        foreach ($actionItems as [$content, [, $author], $attributes]) {
            ActionItem::factory()->create([
                'retro_id' => $retro->id,
                'created_by_participant_id' => $author->id,
                'content' => $content,
                ...$attributes,
            ]);
        }
    }

    if ($phase === RetroPhase::Actions) {
        $topic = Card::query()->where('retro_id', $retro->id)->where('content', 'like', 'We discover scope changes%')->sole();
        $retro->update(['highlighted_card_id' => $topic->id]);

        $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create([
            'id' => '0199b000-0000-7000-8000-000000000002',
            'team_id' => $team->id,
            'title' => 'Sprint 41 retro',
            'created_at' => '2026-09-18 10:00:00',
            'completed_at' => '2026-09-18 11:00:00',
        ]);

        ActionItem::factory()->create([
            'retro_id' => $earlier->id,
            'content' => 'Review the definition of ready with the product owner',
            'assignee_user_id' => $people[0][0]->id,
            'due_on' => '2026-09-29',
        ]);
    }

    if ($phase === RetroPhase::Completed) {
        $retro->forceFill(['started_at' => '2026-10-02 09:02:00'])->save();

        $earlier = Retro::factory()->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
            'id' => '0199b000-0000-7000-8000-000000000002',
            'team_id' => $team->id,
            'title' => 'Sprint 41 retro',
            'created_at' => '2026-09-18 10:00:00',
            'completed_at' => '2026-09-18 11:00:00',
        ]);
        $earlierParticipant = Participant::factory()->create(['retro_id' => $earlier->id, 'user_id' => $people[0][0]->id]);

        $answers = [
            [HealthStatement::Interaction, [4, 5], 4],
            [HealthStatement::TaskClarity, [4, 4], 4],
            [HealthStatement::ManagerSupport, [5, 5], 5],
            [HealthStatement::Vision, [3, 4], 3],
            [HealthStatement::Processes, [3, 3], 3],
        ];

        attachHealthCheck($retro);

        foreach ([0, 1] as $index) {
            answerHealthCheck($retro, $people[$index][1], collect($answers)->mapWithKeys(fn (array $answer): array => [$answer[0]->value => $answer[1][$index]])->all());
        }

        answerHealthCheck($earlier, $earlierParticipant, collect($answers)->mapWithKeys(fn (array $answer): array => [$answer[0]->value => $answer[2]])->all());
        closeHealthCheck($retro);
        closeHealthCheck($earlier);

        foreach ([4, 5] as $index => $score) {
            RotiVote::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => $people[$index][1]->id,
                'score' => $score,
            ]);
        }

        ActionItem::query()->where('retro_id', $retro->id)->whereNull('due_on')->update([
            'assignee_user_id' => $people[0][0]->id,
            'due_on' => '2031-10-17',
        ]);
    }

    if ($phase === RetroPhase::Roti) {
        RotiVote::factory()->create([
            'retro_id' => $retro->id,
            'participant_id' => $people[0][1]->id,
            'score' => 4,
        ]);
    }

    if ($phase === RetroPhase::Icebreaker) {
        $retro->update(['icebreaker_enabled' => true, 'icebreaker_game' => GameKind::Hangman]);
        $room = GameRoom::factory()->icebreaker($retro)->game(GameKind::Hangman)->create([
            'id' => '0199b000-0000-7000-8000-000000000030',
        ]);

        foreach ($people as [, $participant]) {
            GamePlayer::factory()->forParticipant($participant)->create(['game_room_id' => $room->id]);
        }

        if ($icebreakerRound) {
            activeGameRound($room, ['word' => 'sprint', 'picked_letters' => ['s', 'e', 'a'], 'revealed_positions' => [0], 'misses' => 2]);
        }
    }

    return [$retro->fresh(), $people[0][0], $people[1][0]];
}

it('[P18e-R3-01] renders the board in its session shell without overflow', function (string $name, RetroPhase $phase, bool $asFacilitator, bool $isLocked, bool $isAnonymous = false, bool $icebreakerRound = false, bool $hideVoteCounts = false) {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    if ($phase === RetroPhase::Completed) {
        config(['mail.default' => 'smtp']);
    }

    [$retro, $facilitator, $member] = p18eRetroVisualBoard($phase, $icebreakerRound);
    $retro->update(['is_locked' => $isLocked, 'is_anonymous' => $isAnonymous, 'hide_vote_counts' => $hideVoteCounts]);
    $viewer = $asFacilitator ? $facilitator : $member;

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($viewer, $retro, $phase, $asFacilitator) {
            User::query()->whereKey($viewer->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $viewer->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate($path);

            $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->assertCount('[data-realtime]', 1)
                ->assertScript("document.querySelectorAll('main').length", 1)
                ->assertPresent('[data-slot="session-frame"] header h1, [data-slot="sidebar-wrapper"] header h1')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            if ($phase === RetroPhase::Grouping && $asFacilitator) {
                $commented = CardComment::query()->where('retro_id', $retro->id)->sole();
                $toggle = "#card-{$commented->card_id} [data-slot=\"retro-card-comments\"]";

                $page->click($toggle)
                    ->assertAriaAttribute($toggle, 'expanded', 'true')
                    ->assertPresent("#card-{$commented->card_id} [data-slot=\"comment\"]");
            }

            return $page;
        },
    );
})->with([
    'facilitator, icebreaker, before the round' => ['retro-board-icebreaker', RetroPhase::Icebreaker, true, false],
    'participant, icebreaker, round running' => ['retro-board-icebreaker-round', RetroPhase::Icebreaker, false, false, false, true],
    'facilitator, writing' => ['retro-board-facilitator', RetroPhase::Writing, true, false],
    'facilitator, writing, anonymous' => ['retro-board-anonymous', RetroPhase::Writing, true, false, true],
    'facilitator, grouping' => ['retro-board-grouping', RetroPhase::Grouping, true, false],
    'participant, grouping, anonymous, locked' => ['retro-board-grouping-locked', RetroPhase::Grouping, false, true, true],
    'facilitator, voting, totals hidden' => ['retro-board-voting', RetroPhase::Voting, true, false, false, false, true],
    'participant, voting, locked' => ['retro-board-participant', RetroPhase::Voting, false, true],
    'facilitator, discussing' => ['retro-board-discussing', RetroPhase::Discussing, true, false],
    'participant, discussing, locked' => ['retro-board-discussing-locked', RetroPhase::Discussing, false, true],
    'facilitator, actions' => ['retro-board-actions', RetroPhase::Actions, true, false],
    'participant, actions, locked' => ['retro-board-actions-locked', RetroPhase::Actions, false, true],
    'facilitator, roti, has voted' => ['retro-board-roti', RetroPhase::Roti, true, false],
    'participant, roti, thinking, locked' => ['retro-board-roti-participant', RetroPhase::Roti, false, true],
    'facilitator, completed' => ['retro-board-completed', RetroPhase::Completed, true, false],
]);

/**
 * The board in Writing with a health check of three statements: the member has sent his answers, the facilitator not
 * yet; with `$closed`, the facilitator has sent too and the health check is closed.
 *
 * @return array{
 *     0: Retro,
 *     1: User
 * }
 */
function p19RetroHealthCheckBoard(bool $closed): array
{
    [$retro, $facilitator] = p18eRetroVisualBoard(RetroPhase::Writing);

    foreach ([HealthStatement::Interaction, HealthStatement::TaskClarity, HealthStatement::Vision] as $position => $statement) {
        TeamHealthStatement::factory()->builtin($statement)->create(['team_id' => $retro->team_id, 'position' => $position]);
    }

    attachHealthCheck($retro);

    $participants = Participant::query()->where('retro_id', $retro->id)->orderBy('id')->get()->values();
    answerHealthCheck($retro, $participants[1], ['interaction' => 4, 'task_clarity' => 3, 'vision' => 2]);

    if ($closed) {
        answerHealthCheck($retro, $participants[0], ['interaction' => 5, 'task_clarity' => 4, 'vision' => 3]);
        closeHealthCheck($retro);
    }

    return [$retro->fresh(), $facilitator];
}

/**
 * The dialog is opened at the width of the visit; at a phone's width, the harness's resize turns it into its drawer.
 *
 * @param  array<string, string>  $options
 */
function p19OpenRetroHealthCheck(User $viewer, Retro $retro, array $options): mixed
{
    User::query()->whereKey($viewer->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

    $page = visit('/login', $options);

    $page->fill('#email', $viewer->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');

    return $page->navigate("/retros/{$retro->id}")
        ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
        ->click('button[aria-haspopup="dialog"]:has([data-slot="health-check-count"])')
        ->assertPresent('[data-slot="retro-health-check-dialog"]');
}

it('[P19-31-10] renders the health-check dialog of a retro in Writing, three statements scored, without overflow', function () {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    [$retro, $facilitator] = p19RetroHealthCheckBoard(closed: false);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'retro-health-check-dialog',
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($facilitator, $retro) {
            $page = p19OpenRetroHealthCheck($facilitator, $retro, $options);
            $dialog = '[data-slot="retro-health-check-dialog"]';

            return $page->assertSeeIn('[data-slot="health-check-count"]', '1/2')
                ->click("{$dialog} [data-statement-key=\"interaction\"] [data-score=\"4\"]")
                ->click("{$dialog} [data-statement-key=\"task_clarity\"] [data-score=\"5\"]")
                ->click("{$dialog} [data-statement-key=\"vision\"] [data-score=\"3\"]")
                ->assertCount("{$dialog} [data-slot=\"health-question\"][data-answered=\"true\"]", 3)
                ->assertScript("[...document.querySelectorAll('{$dialog} [data-slot=\"health-check-form\"] button')].at(-1).disabled", false);
        },
    );
});

it('[P19-31-11] renders the results of the closed health check of a retro, with their distribution, without overflow', function () {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    [$retro, $facilitator] = p19RetroHealthCheckBoard(closed: true);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'retro-health-check-results',
        "/retros/{$retro->id}",
        fn (string $path, array $options) => p19OpenRetroHealthCheck($facilitator, $retro, $options)
            ->assertNotPresent('[data-slot="retro-health-check-dialog"] [data-slot="health-check-form"]')
            ->click('[data-slot="retro-health-result"] button')
            ->assertCount('[data-slot="health-check-results"] [data-slot="health-distribution"]', 3),
    );
});

it('[P18e-R13-01] renders the drawers of the phone board at 390 without overflow', function (string $name, RetroPhase $phase, string $trigger, string $drawer) {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    [$retro, $facilitator] = p18eRetroVisualBoard($phase);

    RateLimiter::for('login', fn (): Limit => Limit::none());
    File::ensureDirectoryExists(base_path('tests/visual/__screenshots__'));

    $settle = '() => document.fonts.ready'
        .'.then(() => Promise.allSettled(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished)))'
        .'.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))';

    foreach (['light', 'dark'] as $theme) {
        foreach (['en' => 'en-US', 'fr' => 'fr-FR'] as $locale => $browserLocale) {
            User::query()->whereKey($facilitator->id)->update(['locale' => $locale]);

            $page = visit('/login', ['colorScheme' => $theme, 'locale' => $browserLocale, 'reducedMotion' => 'reduce']);

            $page->fill('#email', $facilitator->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate("/retros/{$retro->id}");

            $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->resize(390, 844)
                ->click($trigger)
                ->assertPresent($drawer);

            $page->script($settle);

            $label = "{$name}-{$theme}-390-{$locale}";

            expect($this->overflowingElements($page))->toBe([], "Horizontal overflow in {$label}");

            $page->screenshot(fullPage: true, filename: "{$label}.candidate");

            CaptureFile::replaceWhenPictureDiffers(
                base_path("tests/Browser/Screenshots/{$label}.candidate"),
                base_path("tests/visual/__screenshots__/{$label}.png"),
            );
        }
    }
})->with([
    'the card of the round button, writing' => ['retro-phone-add-card', RetroPhase::Writing, '[data-slot="retro-add-card"]', '[data-slot="retro-add-card-drawer"] textarea'],
    'the topics, discussing' => ['retro-phone-topics', RetroPhase::Discussing, '[data-slot="retro-topics-selector"] button', '[data-slot="retro-topics-drawer"] [data-test="retro-topics"]'],
    'a new action, actions' => ['retro-phone-action', RetroPhase::Actions, '[data-test="retro-action-items-panel"] button[aria-haspopup="dialog"]', '[data-slot="retro-action-drawer"] [data-slot="assignee-chips"]'],
]);

it('[P18e-08-04] renders the surveys column and an open thread at 390 without overflow', function () {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    [$retro, $facilitator, $member] = p18eRetroVisualBoard(RetroPhase::Writing);
    $fran = Participant::query()->where('retro_id', $retro->id)->where('user_id', $facilitator->id)->sole();
    $max = Participant::query()->where('retro_id', $retro->id)->where('user_id', $member->id)->sole();

    $mood = Survey::factory()->single()->withOptions(['Energised', 'Steady', 'Running on empty, and it shows in the reviews'])->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $fran->id,
        'question' => 'How did this sprint leave you?',
        'description' => 'One answer. Results show once you have answered.',
        'show_voters' => true,
        'position' => 0,
    ]);
    $options = $mood->options()->orderBy('position')->get();

    SurveyResponse::factory()->create(['survey_id' => $mood->id, 'survey_option_id' => $options[0]->id, 'participant_id' => $fran->id]);
    SurveyResponse::factory()->create(['survey_id' => $mood->id, 'survey_option_id' => $options[1]->id, 'participant_id' => $max->id]);
    SurveyComment::factory()->create([
        'retro_id' => $retro->id,
        'survey_id' => $mood->id,
        'participant_id' => $max->id,
        'content' => 'Steady, but the last two days were a rush to the demo.',
    ]);

    Survey::factory()->multiple()->withOptions(['Pairing', 'Smaller pull requests', 'A quieter Thursday'])->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $fran->id,
        'question' => 'What should we keep doing?',
        'position' => 1,
    ]);

    $wish = Survey::factory()->text()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $fran->id,
        'question' => 'One thing to change next sprint?',
        'position' => 2,
    ]);

    SurveyTextAnswer::factory()->create([
        'survey_id' => $wish->id,
        'participant_id' => $fran->id,
        'content' => 'Freeze the scope on day two.',
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());
    File::ensureDirectoryExists(base_path('tests/visual/__screenshots__'));

    $settle = '() => document.fonts.ready'
        .'.then(() => Promise.allSettled(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished)))'
        .'.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))';

    $capture = function (mixed $page, string $label) use ($settle): void {
        $page->script($settle);

        expect($this->overflowingElements($page))->toBe([], "Horizontal overflow in {$label}");

        $page->screenshot(fullPage: true, filename: "{$label}.candidate");

        CaptureFile::replaceWhenPictureDiffers(
            base_path("tests/Browser/Screenshots/{$label}.candidate"),
            base_path("tests/visual/__screenshots__/{$label}.png"),
        );
    };

    $thread = "[data-test=\"retro-survey-{$mood->id}\"]";

    foreach (['light', 'dark'] as $theme) {
        foreach (['en' => 'en-US', 'fr' => 'fr-FR'] as $locale => $browserLocale) {
            User::query()->whereKey($facilitator->id)->update(['locale' => $locale]);

            $page = visit('/login', ['colorScheme' => $theme, 'locale' => $browserLocale, 'reducedMotion' => 'reduce']);

            $page->fill('#email', $facilitator->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate("/retros/{$retro->id}");

            $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->resize(390, 844)
                ->click('[data-slot="column-tab"][id$="+surveys"]')
                ->assertCount('[data-slot="retro-surveys"] [data-slot="survey-question"]', 3)
                ->assertPresent("{$thread} [data-slot=\"survey-result-bar\"]");

            $capture($page, "retro-phone-surveys-{$theme}-390-{$locale}");

            $page->click("{$thread} [data-slot=\"survey-comments-toggle\"]")
                ->assertAriaAttribute("{$thread} [data-slot=\"survey-comments-toggle\"]", 'expanded', 'true')
                ->assertPresent("{$thread} [data-slot=\"comment\"]");

            $capture($page, "retro-phone-survey-thread-{$theme}-390-{$locale}");
        }
    }
});
