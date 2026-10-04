<?php

use App\Enums\TeamRole;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardDeleted;
use App\Events\Whiteboards\WhiteboardTimerChanged;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardTemplate;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

dataset('whiteboard changes', [
    'settings' => ['patchJson', 'whiteboards.settings.update', ['title' => 'Changed']],
    'guest link' => ['postJson', 'whiteboards.guestToken.store', []],
    'timer' => ['putJson', 'whiteboards.timer.update', ['seconds' => 60]],
    'timer extension' => ['postJson', 'whiteboards.timer.extension.store', []],
    'deletion' => ['deleteJson', 'whiteboards.destroy', []],
]);

it('refuses every board change and upload an observer sends, and changes nothing', function (string $method, string $route, array $body) {
    Storage::fake('local');
    Event::fake([WhiteboardChanged::class, WhiteboardDeleted::class, WhiteboardTimerChanged::class]);

    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Kept', 'timer_ends_at' => now()->addMinute()]);
    whiteboardFacilitator($board);
    $observer = teamMember($board->team, TeamRole::Observer);
    $guestToken = $board->guest_token;

    $this->actingAs($observer)->{$method}(route($route, $board), $body)
        ->assertForbidden()
        ->assertJsonPath('message', 'Observers can follow this session but not take part.');

    expect($board->fresh())->not->toBeNull()
        ->and($board->fresh()->title)->toBe('Kept')
        ->and($board->fresh()->guest_token)->toBe($guestToken);

    Event::assertNothingDispatched();
})->with('whiteboard changes');

it('refuses an observer who uploads an image, duplicates the board or saves it as a template', function (string $route, array $body) {
    Storage::fake('local');

    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    $observer = teamMember($board->team, TeamRole::Observer);

    $this->actingAs($observer)->post(route($route, $board), $body, ['Accept' => 'application/json'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Observers can follow this session but not take part.');

    expect(Whiteboard::query()->count())->toBe(1)
        ->and(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(Storage::disk('local')->allFiles())->toBeEmpty();
})->with([
    'image' => ['whiteboards.files.store', fn () => ['id' => 'file-1', 'file' => UploadedFile::fake()->image('note.png')]],
    'duplicate' => ['whiteboards.duplicate.store', []],
    'template' => ['whiteboards.template.store', ['name' => 'Ours']],
]);

it('refuses an observer who creates a board for the team', function () {
    $board = Whiteboard::factory()->create();
    $observer = teamMember($board->team, TeamRole::Observer);

    $this->actingAs($observer)
        ->post(route('teams.whiteboards.store', [$board->team->workspace, $board->team]), ['title' => 'Nope'])
        ->assertForbidden();

    expect(Whiteboard::query()->count())->toBe(1);
});

it('lets a facilitator who became an observer keep driving the board they facilitate', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $board->team->members()->updateExistingPivot($user->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.timer.update', $board), ['seconds' => 300])
        ->assertOk();

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['locked' => true])
        ->assertNoContent();

    expect($board->fresh()->timer_ends_at)->not->toBeNull()
        ->and($board->fresh()->locked)->toBeTrue();
});

it('refuses a facilitator who became an observer a new board or a template made from theirs', function (string $route, array $body) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    $board->team->members()->updateExistingPivot($user->id, ['role' => TeamRole::Observer->value]);

    $this->actingAs($user)->postJson(route($route, $board), $body)->assertForbidden();

    expect(Whiteboard::query()->count())->toBe(1)
        ->and(WhiteboardTemplate::query()->count())->toBe(0);
})->with([
    'duplicate' => ['whiteboards.duplicate.store', []],
    'template' => ['whiteboards.template.store', ['name' => 'Ours']],
]);

it('refuses a guest who changes the settings, asks for a new guest link or deletes the board', function (string $method, string $route, array $body) {
    Event::fake([WhiteboardChanged::class, WhiteboardDeleted::class, WhiteboardTimerChanged::class]);

    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Kept']);
    whiteboardFacilitator($board);
    $guest = whiteboardGuest($board);
    $guestToken = $board->guest_token;

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->{$method}(route($route, $board), $body)
        ->assertForbidden();

    expect($board->fresh())->not->toBeNull()
        ->and($board->fresh()->title)->toBe('Kept')
        ->and($board->fresh()->guest_token)->toBe($guestToken);

    Event::assertNothingDispatched();
})->with('whiteboard changes');

it('refuses a new guest link to a member who does not facilitate, and keeps the guests signed in', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->withGuestAccess()->create();
    whiteboardFacilitator($board);
    [$user] = whiteboardMember($board);
    $guest = whiteboardGuest($board);
    $guestToken = $board->guest_token;

    $this->actingAs($user)
        ->postJson(route('whiteboards.guestToken.store', $board))
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator can do this.');

    expect($board->fresh()->guest_token)->toBe($guestToken)
        ->and($guest->fresh()->guest_secret_hash)->not->toBeNull();

    Event::assertNotDispatched(WhiteboardChanged::class);
});

it('tells the others when the facilitator replaces the guest link', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->withGuestAccess()->create();
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->postJson(route('whiteboards.guestToken.store', $board))
        ->assertOk();

    Event::assertDispatched(fn (WhiteboardChanged $event): bool => $event->boardId === $board->id);
});

it('refuses a title longer than 120 characters and keeps the old one', function () {
    $board = Whiteboard::factory()->create(['title' => 'Kept']);
    [$user] = whiteboardFacilitator($board);

    $this->actingAs($user)
        ->patchJson(route('whiteboards.settings.update', $board), ['title' => str_repeat('a', 121)])
        ->assertJsonValidationErrors('title');

    expect($board->fresh()->title)->toBe('Kept');
});

it('refuses a hand-over to an observer of the team', function () {
    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $observer = teamMember($board->team, TeamRole::Observer);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $observer->id])
        ->assertJsonValidationErrors(['user_id' => 'The facilitator must be a member of this team.']);

    expect($board->fresh()->facilitator?->user_id)->toBe($facilitator->id);
});

it('tells the others when the facilitator changes', function () {
    Event::fake([WhiteboardChanged::class]);

    $board = Whiteboard::factory()->create();
    [$facilitator] = whiteboardFacilitator($board);
    $next = teamMember($board->team);

    $this->actingAs($facilitator)
        ->putJson(route('whiteboards.facilitator.update', $board), ['user_id' => $next->id])
        ->assertNoContent();

    Event::assertDispatched(fn (WhiteboardChanged $event): bool => $event->boardId === $board->id);
});

it('refuses a workspace admin of another workspace, who can neither open nor delete the board', function () {
    $board = Whiteboard::factory()->create();
    whiteboardFacilitator($board);
    $elsewhereAdmin = workspaceManager(Whiteboard::factory()->create()->team->workspace);

    $this->actingAs($elsewhereAdmin)->get(route('whiteboards.show', $board))->assertForbidden();
    $this->actingAs($elsewhereAdmin)->deleteJson(route('whiteboards.destroy', $board))->assertForbidden();

    expect($board->fresh())->not->toBeNull()
        ->and(WhiteboardMember::query()->where('whiteboard_id', $board->id)->where('user_id', $elsewhereAdmin->id)->exists())->toBeFalse();
});

it('creates no guest from a link whose guest access is off', function () {
    $board = Whiteboard::factory()->create(['guest_access_enabled' => false]);

    $this->post(route('whiteboards.join.store', $board->guest_token), ['name' => 'Ada'])->assertNotFound();

    expect($board->members()->count())->toBe(0);
});

it('sends a team member who posts the join form to the board, without a guest member', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $member = teamMember($board->team);

    $this->actingAs($member)
        ->post(route('whiteboards.join.store', $board->guest_token), ['name' => 'Ada'])
        ->assertRedirect(route('whiteboards.show', $board));

    expect($board->members()->whereNull('user_id')->count())->toBe(0);
});
