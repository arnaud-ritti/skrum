<?php

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

it('[P18e-04-02] renders the team page of a manager without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000021',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $team->members()->attach($admin);

    $names = ['Arnaud Ritti', 'Théo Martin', 'Inès Benali', 'Malik Kone', 'Sofia Lindqvist', 'Noa Kim', 'Maximilian Alexander von Hohenberg-Lichtenstein', 'Zoé Petit'];

    foreach ($names as $index => $name) {
        $member = User::factory()->create([
            'id' => sprintf('0199a000-0000-7000-8000-0000000001%02d', $index),
            'name' => $name,
            'email' => str($name)->slug('.').'@nordlys.example',
        ]);
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $olga = User::factory()->create(['name' => 'Olga Nowak']);
    $workspace->members()->attach($olga, ['role' => WorkspaceRole::Member->value]);

    $retro = function (string $title, string $template, RetroPhase $phase, int $daysAgo) use ($team, $admin): Retro {
        $this->travelTo(now()->subDays($daysAgo));
        $retro = Retro::factory()->for($team)->inPhase($phase)->create([
            'title' => $title,
            'template' => $template,
            'completed_at' => $phase === RetroPhase::Completed ? now() : null,
        ]);
        $retro->update(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id])->id]);
        $this->travelBack();

        return $retro;
    };

    $retro('Sprint 42 retrospective', 'four_ls', RetroPhase::Writing, 0);
    $retro('Q3 release post-mortem', 'mad_sad_glad', RetroPhase::Voting, 1);
    $closed = $retro('Sprint 41 retrospective', 'start_stop_continue', RetroPhase::Completed, 14);
    $older = $retro('Sprint 40 retrospective', 'sailboat', RetroPhase::Completed, 28);

    foreach ([[$closed, [4, 4, 5, 4]], [$older, [4, 3, 4, 4]]] as [$voted, $scores]) {
        foreach ($scores as $score) {
            RotiVote::factory()->create(['retro_id' => $voted->id, 'score' => $score]);
        }
    }

    $refinement = PokerGame::factory()->for($team)->create(['title' => 'Sprint 43 refinement']);
    PokerTask::factory()->count(3)->create(['poker_game_id' => $refinement->id]);
    PokerTask::factory()->estimated('8')->count(2)->create(['poker_game_id' => $refinement->id]);
    $sizing = PokerGame::factory()->for($team)->create(['title' => 'Billing epic sizing']);
    PokerTask::factory()->count(9)->create(['poker_game_id' => $sizing->id]);
    $spikes = PokerGame::factory()->for($team)->ended()->create(['title' => 'Mobile app spikes']);
    PokerTask::factory()->estimated('13')->count(2)->create(['poker_game_id' => $spikes->id]);

    foreach (['Invite flow — user journey', 'Realtime architecture', 'Q4 roadmap brainstorm'] as $index => $title) {
        $board = Whiteboard::factory()->for($team)->create(['title' => $title]);
        $board->update(['facilitator_member_id' => WhiteboardMember::factory()->create([
            'whiteboard_id' => $board->id,
            'user_id' => $index === 0 ? $admin->id : User::query()->where('name', $names[$index])->value('id'),
        ])->id]);
    }

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $path = route('teams.show', [$workspace, $team], false);

    $this->captureVisuals('team-page', $path, function (string $path, array $options) use ($admin) {
        User::query()->whereKey($admin->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

        $page = visit('/login', $options);

        $page->fill('#email', $admin->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        return $page->navigate($path)
            ->assertCount('[data-slot="team-retros"] [data-slot="card"]', 4)
            ->assertCount('[data-slot="team-poker-game"]', 3)
            ->assertCount('[data-slot="team-whiteboards"] [data-slot="card"]', 3)
            ->assertCount('#members [data-slot="team-members"] li', 6)
            ->assertPresent('[data-slot="team-settings"]')
            ->assertNotPresent('[data-slot="poker-presence-loading"]')
            ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
    });
});

it('[P18e-04-02b] renders the states of the team page on the bench without overflow', function () {
    $this->captureVisuals(
        'team',
        '/dev/design-system/team',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="team"]')
            ->assertPresent('[data-state="manager"] [data-slot="team-page"]')
            ->assertCount('[data-state="empty"] [data-slot="empty-state"]', 3)
            ->assertCount('[data-state="presence-loading"] [data-slot="poker-presence-loading"]', 2),
    );
});
