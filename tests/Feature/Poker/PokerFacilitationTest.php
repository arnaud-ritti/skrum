<?php

use App\Enums\WorkspaceRole;
use App\Events\Poker\PokerGameChanged;
use App\Events\Poker\PokerGameDeleted;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

beforeEach(function () {
    Event::fake();
});

it('transfers facilitation to a team member', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertNoContent();

    expect($game->fresh()->facilitator_player_id)->toBe($memberPlayer->id);
    Event::assertDispatched(PokerGameChanged::class);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertForbidden();
});

it('transfers facilitation to a workspace admin who never joined', function () {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    $admin = workspaceManager($game->team->workspace);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $admin->id])
        ->assertNoContent();

    $adminPlayer = PokerPlayer::query()->where('poker_game_id', $game->id)->where('user_id', $admin->id)->sole();

    expect($game->fresh()->facilitator_player_id)->toBe($adminPlayer->id);
});

it('refuses transfers to outsiders', function () {
    $game = PokerGame::factory()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    $outsider = User::factory()->create();

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $outsider->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['user_id' => 'The facilitator must be a member of this team.']);

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id)
        ->and(PokerPlayer::query()->where('user_id', $outsider->id)->exists())->toBeFalse();
});

it('lets a member take control', function () {
    $game = PokerGame::factory()->create();
    [, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);
    [$other] = pokerMember($game);

    $this->actingAs($member)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $other->id])
        ->assertForbidden();

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id);

    $this->actingAs($member)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertNoContent();

    expect($game->fresh()->facilitator_player_id)->toBe($memberPlayer->id);
});

it('refuses guests taking control', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $facilitator->id])
        ->assertForbidden();

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id);
});

it('refuses a guest before validating the user id', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    pokerFacilitator($game);
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials()
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => (string) Str::uuid()])
        ->assertForbidden();
});

it('lets a member take control of an ended game to reopen it', function () {
    $game = PokerGame::factory()->ended()->create();
    pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    $this->actingAs($member)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertNoContent();

    expect($game->fresh()->facilitator_player_id)->toBe($memberPlayer->id);

    $this->actingAs($member)
        ->putJson(route('poker.status.update', $game), ['ended' => false])
        ->assertNoContent();

    expect($game->fresh()->ended_at)->toBeNull();
});

it('refuses hand-overs on an ended game', function () {
    $game = PokerGame::factory()->ended()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member] = pokerMember($game);

    $this->actingAs($facilitator)
        ->putJson(route('poker.facilitator.update', $game), ['user_id' => $member->id])
        ->assertForbidden();

    expect($game->fresh()->facilitator_player_id)->toBe($facilitatorPlayer->id);
});

it('deletes as facilitator or workspace admin only', function (string $who) {
    $game = PokerGame::factory()->create();
    [$facilitator] = pokerFacilitator($game);
    [$member] = pokerMember($game);
    $actor = match ($who) {
        'facilitator' => $facilitator,
        'admin' => workspaceManager($game->team->workspace),
        'owner' => workspaceManager($game->team->workspace, WorkspaceRole::Owner),
    };

    $this->actingAs($member)
        ->deleteJson(route('poker.destroy', $game))
        ->assertForbidden()
        ->assertJsonPath('message', 'Only the facilitator or a workspace admin can delete this game.');

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeTrue();

    $this->actingAs($actor)->deleteJson(route('poker.destroy', $game))->assertNoContent();

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeFalse();
    Event::assertDispatched(PokerGameDeleted::class, fn (PokerGameDeleted $event) => $event->gameId === $game->id);
})->with(['facilitator', 'admin', 'owner']);

it('deletes ended games', function () {
    $game = PokerGame::factory()->ended()->create();
    [$facilitator] = pokerFacilitator($game);

    $this->actingAs($facilitator)->deleteJson(route('poker.destroy', $game))->assertNoContent();

    expect(PokerGame::query()->whereKey($game->id)->exists())->toBeFalse();
});
