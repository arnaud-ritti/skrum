<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\ColumnColor;
use App\Enums\GameKind;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

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
        fn (string $path, array $options) => visit($path, $options)->assertPresent($marker),
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

    if (in_array($phase, [RetroPhase::Grouping, RetroPhase::Voting], true)) {
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

    if ($phase === RetroPhase::Voting) {
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

    if ($phase === RetroPhase::HealthCheck) {
        $retro->update(['health_check_enabled' => true]);
        resolve(FreezeHealthStatements::class)->handle($retro);

        $answers = [
            [HealthStatement::Interaction, [8, 6]],
            [HealthStatement::TaskClarity, [6, null]],
            [HealthStatement::ManagerSupport, [null, 9]],
            [HealthStatement::Vision, [10, 7]],
        ];

        foreach ($answers as [$statement, $scores]) {
            foreach (array_filter($scores) as $index => $score) {
                HealthCheckAnswer::factory()->create([
                    'retro_id' => $retro->id,
                    'participant_id' => $people[$index][1]->id,
                    'statement' => $statement->value,
                    'score' => $score,
                ]);
            }
        }
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
    'facilitator, health check' => ['retro-board-health', RetroPhase::HealthCheck, true, false],
    'participant, health check, locked' => ['retro-board-health-locked', RetroPhase::HealthCheck, false, true],
    'facilitator, icebreaker, before the round' => ['retro-board-icebreaker', RetroPhase::Icebreaker, true, false],
    'participant, icebreaker, round running' => ['retro-board-icebreaker-round', RetroPhase::Icebreaker, false, false, false, true],
    'facilitator, writing' => ['retro-board-facilitator', RetroPhase::Writing, true, false],
    'facilitator, writing, anonymous' => ['retro-board-anonymous', RetroPhase::Writing, true, false, true],
    'facilitator, grouping' => ['retro-board-grouping', RetroPhase::Grouping, true, false],
    'participant, grouping, anonymous, locked' => ['retro-board-grouping-locked', RetroPhase::Grouping, false, true, true],
    'facilitator, voting, totals hidden' => ['retro-board-voting', RetroPhase::Voting, true, false, false, false, true],
    'participant, voting, locked' => ['retro-board-participant', RetroPhase::Voting, false, true],
    'facilitator, completed' => ['retro-board-completed', RetroPhase::Completed, true, false],
]);
