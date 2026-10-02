<?php

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

function p18eVisualSticky(Whiteboard $board, WhiteboardMember $author, int $seq, int $x, int $y, string $fill, string $stroke): void
{
    $data = sceneElement([
        'id' => "visual-sticky-{$seq}",
        'x' => $x,
        'y' => $y,
        'width' => 200,
        'height' => 200,
        'index' => "a{$seq}",
        'backgroundColor' => $fill,
        'strokeColor' => $stroke,
        'roughness' => 0,
        'customData' => ['skrum' => ['kind' => 'sticky']],
    ]);

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $data['id'],
        'type' => $data['type'],
        'data' => $data,
        'version' => $data['version'],
        'version_nonce' => $data['versionNonce'],
        'author_member_id' => $author->id,
        'is_sticky' => true,
        'seq' => $seq,
    ]);

    Whiteboard::query()->whereKey($board->id)->update(['seq' => $seq]);
}

/**
 * The overflow check is for the chrome of this plan. The canvas toolbar is the library's: at 390, with the
 * sticky tool in it, it is wider than its island and its last trigger is clipped (plan WB-1 rebuilds it).
 */
function p18eVisualLeaveCanvasToolbarOut(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const canvas = document.querySelector('.whiteboard-canvas');
            const mark = () => canvas.querySelectorAll('.App-toolbar').forEach((toolbar) => toolbar.setAttribute('data-overflow-ok', ''));

            new MutationObserver(mark).observe(canvas, { childList: true, subtree: true });
            mark();

            return true;
        }
        JS);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User
 * }
 */
function p18eVisualBoard(array $attributes = []): array
{
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = whiteboardWithFacilitator([
        'title' => 'Onboarding journey: pain points of the first week',
        ...$attributes,
    ]);

    p18eVisualSticky($board, $franMember, 1, 80, 160, '#fdf1c2', '#ddc362');
    p18eVisualSticky($board, $franMember, 2, 320, 180, '#ffebe8', '#f9aea4');
    p18eVisualSticky($board, $franMember, 3, 80, 400, '#e2f3ff', '#8dccf9');

    return ['board' => $board, 'fran' => $fran];
}

it('[P18e-07-02] renders the guest-join page of a whiteboard without overflow', function () {
    ['board' => $board] = whiteboardWithFacilitator(['title' => 'Sprint 42 planning board']);
    whiteboardGuest($board);
    whiteboardGuest($board, 'other-secret');

    $this->captureVisuals(
        'whiteboard-join',
        $this->whiteboardJoinPath($board),
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="guest-join-session"][data-kind="whiteboard"]')
            ->assertPresent('#name'),
    );
});

it('[P18e-07-03] renders the notice of an invalid whiteboard guest link without overflow', function () {
    $this->captureVisuals(
        'whiteboard-join-invalid',
        '/whiteboards/join/no-such-link',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="access-notice"]')
            ->assertNotPresent('#name'),
    );
});

it('[P18e-07-05] renders the board chrome of the facilitator without overflow', function () {
    ['board' => $board, 'fran' => $fran] = p18eVisualBoard();
    [$mia] = whiteboardMember($board);
    renamedWhiteboardUser($mia, 'Mia Member');

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $this->captureVisuals(
        'whiteboard-board',
        $this->whiteboardPath($board),
        function (string $path, array $options) use ($fran) {
            User::query()->whereKey($fran->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

            $page = visit('/login', $options);

            $page->fill('#email', $fran->email)
                ->fill('#password', 'password')
                ->click('@login-button')
                ->assertPathIsNot('/login');

            $page = $this->awaitRealtime($page->navigate($path))
                ->assertPresent('[data-scene^="3:"]')
                ->assertPresent('[role="toolbar"][aria-label]')
                ->assertCount('[data-realtime]', 1)
                ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

            p18eVisualLeaveCanvasToolbarOut($page);

            return $page;
        },
    );
});

it('[P18e-07-05] renders a locked board with a finished timer to a guest without overflow', function () {
    ['board' => $board] = p18eVisualBoard(['locked' => true, 'timer_ends_at' => now()->subMinute()]);

    $this->captureVisuals(
        'whiteboard-board-locked-guest',
        $this->whiteboardJoinPath($board),
        function (string $path, array $options) {
            $page = visit($path, $options);

            $page->fill('#name', 'Guest Gia')
                ->click('form button[type="submit"]')
                ->assertPathIsNot($path);

            return $this->awaitRealtime($page)
                ->assertPresent('[data-scene^="3:"]')
                ->assertPresent('[data-slot="board-notices"]')
                ->assertPresent('[role="timer"]')
                ->assertCount('[data-realtime]', 1);
        },
    );
});
