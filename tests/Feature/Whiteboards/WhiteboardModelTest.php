<?php

use App\Actions\Retros\GuestCookie;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

it('creates a board with uuid keys and safe defaults', function () {
    $board = Whiteboard::factory()->create()->fresh();

    expect(Str::isUuid($board->id))->toBeTrue()
        ->and($board->guest_access_enabled)->toBeFalse()
        ->and($board->cursors_enabled)->toBeTrue()
        ->and($board->seq)->toBe(0)
        ->and($board->purged_seq)->toBe(0)
        ->and($board->toArray())->not->toHaveKey('guest_token');
});

it('relates boards to teams, members, elements and files', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->create(['team_id' => $team->id]);
    [, $member] = whiteboardFacilitator($board);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'author_member_id' => $member->id]);
    WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    expect($team->whiteboards()->count())->toBe(1)
        ->and($board->fresh()->isFacilitator($member))->toBeTrue()
        ->and($board->members()->count())->toBe(1)
        ->and($board->elements()->count())->toBe(1)
        ->and($board->files()->count())->toBe(1);
});

it('keeps one row per element id on a board', function () {
    $board = Whiteboard::factory()->create();
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'abc']);

    expect(fn () => WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'abc']))
        ->toThrow(QueryException::class);
});

it('gives guests an identity and a board-scoped cookie', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);

    expect($guest->isGuest())->toBeTrue()
        ->and($guest->toArray())->not->toHaveKey('guest_secret_hash')
        ->and(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id))->toBe("whiteboard_guest_{$board->id}")
        ->and(whiteboardGuestCookie($guest))->toBe(["whiteboard_guest_{$board->id}" => "{$guest->id}|secret"]);
});

it('clears the facilitator when their member row goes', function () {
    $board = Whiteboard::factory()->create();
    [, $member] = whiteboardFacilitator($board);

    WhiteboardMember::query()->whereKey($member->id)->delete();

    expect($board->fresh()->facilitator_member_id)->toBeNull();
});

it('gives a board safe facilitation defaults', function () {
    $board = Whiteboard::factory()->create()->fresh();

    expect($board->locked)->toBeFalse()
        ->and($board->follow_enabled)->toBeFalse()
        ->and($board->timer_ends_at)->toBeNull();
});
