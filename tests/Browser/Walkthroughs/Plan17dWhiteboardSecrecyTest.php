<?php

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

function p17dRenamed(User $user, string $name): User
{
    $user->forceFill(['name' => $name, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17dBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'fran' => p17dRenamed($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

function p17dBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
}

function p17dJoinPath(Whiteboard $board): string
{
    return "/whiteboards/join/{$board->fresh()->guest_token}";
}

/**
 * @param  array<string, mixed>  $settings
 * @return array{
 *     status: int,
 *     body: array<string, mixed>
 * }
 */
function p17dPatchSettings(mixed $page, Whiteboard $board, array $settings): array
{
    $path = json_encode("/whiteboards/{$board->id}/settings", JSON_THROW_ON_ERROR);
    $body = json_encode(json_encode($settings, JSON_THROW_ON_ERROR), JSON_THROW_ON_ERROR);

    $answer = json_decode((string) $page->script(<<<JS
        async () => {
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const response = await fetch({$path}, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                },
                body: {$body},
            });

            return JSON.stringify({ status: response.status, body: await response.text() });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
}

it('[P17d-00g] locks and unlocks the board from the top bar, and another member cannot write while it is locked', function () {
    ['board' => $board, 'fran' => $fran] = p17dBoard();
    [$mia] = whiteboardMember($board);
    p17dRenamed($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, p17dBoardPath($board)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17dBoardPath($board)));

    $this->awaitWhiteboardElements($miaPage, 0);

    $miaPage->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertDontSee('This board is locked.');

    $franPage->assertPresent('button[aria-label="Lock the board"][aria-pressed="false"]')
        ->click('button[aria-label="Lock the board"]')
        ->assertPresent('button[aria-label="Unlock the board"][aria-pressed="true"]')
        ->assertDontSee('This board is locked.');

    $miaPage->assertSee('This board is locked.');

    $refused = $this->writeWhiteboardElements($miaPage, $board, [sceneElement()]);

    expect($board->fresh()->locked)->toBeTrue()
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['locked'])->toBeTrue()
        ->and($this->whiteboardSnapshot($miaPage, $board)['board']['locked'])->toBeTrue()
        ->and($refused['status'])->toBe(403)
        ->and($refused['body']['errors']['locked'][0])->toBe('This board is locked.')
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0);

    $this->addWhiteboardElement($franPage, $board, ['x' => 300, 'y' => 200]);
    $this->awaitWhiteboardElements($miaPage, 1);

    $franPage->click('button[aria-label="Unlock the board"]')
        ->assertPresent('button[aria-label="Lock the board"][aria-pressed="false"]');

    $miaPage->assertDontSee('This board is locked.');

    expect($board->fresh()->locked)->toBeFalse()
        ->and($this->whiteboardSnapshot($franPage, $board)['board']['locked'])->toBeFalse()
        ->and($this->whiteboardSnapshot($miaPage, $board)['board']['locked'])->toBeFalse();

    $this->addWhiteboardElement($miaPage, $board, ['x' => 700, 'y' => 200]);
    $this->awaitWhiteboardElements($franPage, 2);
    $this->awaitWhiteboardScene($franPage, $board);
    $this->awaitWhiteboardScene($miaPage, $board);

    expect(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('is_deleted', false)->count())->toBe(2);
});

it('[P17d-07a] refuses a change of the settings sent by a guest with 403 and changes nothing', function () {
    ['board' => $board] = p17dBoard();

    $guestPage = $this->awaitRealtime($this->joinAsGuest(p17dJoinPath($board), 'Guest Gia'));

    $guestPage->assertNotPresent('[role="toolbar"][aria-label="Facilitation tools"]')
        ->assertNotPresent('button[aria-label="Lock the board"]');

    $answer = p17dPatchSettings($guestPage, $board, [
        'title' => 'Taken over',
        'locked' => true,
        'guest_access_enabled' => false,
    ]);

    $snapshot = $this->whiteboardSnapshot($guestPage, $board);
    $stored = $board->fresh();

    expect($answer['status'])->toBe(403)
        ->and($answer['body']['message'])->toBe('Only the facilitator can do this.')
        ->and($stored->title)->toBe('Sprint board')
        ->and($stored->locked)->toBeFalse()
        ->and($stored->guest_access_enabled)->toBeTrue()
        ->and($snapshot['me']['isGuest'])->toBeTrue()
        ->and($snapshot['me']['isFacilitator'])->toBeFalse()
        ->and($snapshot['board']['title'])->toBe('Sprint board')
        ->and($snapshot['board']['locked'])->toBeFalse()
        ->and($snapshot['board']['guestUrl'])->toBeNull()
        ->and($snapshot['links']['team'])->toBeNull();

    $guestPage->assertSeeIn('header > h1', 'Sprint board')
        ->assertPresent('[data-realtime="connected"]');
});
