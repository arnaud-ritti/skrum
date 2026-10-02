<?php

use App\Enums\ColumnColor;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
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
function p18eRetroVisualBoard(RetroPhase $phase): array
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

    return [$retro->fresh(), $people[0][0], $people[1][0]];
}

it('[P18e-R3-01] renders the board in its session shell without overflow', function (string $name, RetroPhase $phase, bool $asFacilitator, bool $isLocked) {
    config(['app.name' => 'Skrum', 'app.key' => 'base64:'.base64_encode(str_repeat('v', 32))]);

    [$retro, $facilitator, $member] = p18eRetroVisualBoard($phase);
    $retro->update(['is_locked' => $isLocked]);
    $viewer = $asFacilitator ? $facilitator : $member;

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        $name,
        "/retros/{$retro->id}",
        function (string $path, array $options) use ($viewer) {
            User::query()->whereKey($viewer->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $viewer->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page->navigate($path);

            return $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
                ->assertCount('[data-realtime]', 1)
                ->assertScript("document.querySelectorAll('main').length", 1)
                ->assertPresent('[data-slot="session-frame"] header h1, [data-slot="sidebar-wrapper"] header h1')
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
        },
    );
})->with([
    'facilitator, writing' => ['retro-board-facilitator', RetroPhase::Writing, true, false],
    'participant, voting, locked' => ['retro-board-participant', RetroPhase::Voting, false, true],
    'facilitator, completed' => ['retro-board-completed', RetroPhase::Completed, true, false],
]);
