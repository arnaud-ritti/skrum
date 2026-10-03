<?php

use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use App\Support\Sessions\JoinCodes;

dataset('joinable sessions', [
    'retro' => [fn () => Retro::factory()->withGuestAccess()->create(), 'retros.join.show'],
    'poker' => [fn () => PokerGame::factory()->withGuestAccess()->create(), 'poker.join.show'],
    'whiteboard' => [fn () => Whiteboard::factory()->withGuestAccess()->create(), 'whiteboards.join.show'],
    'survey' => [fn () => TeamSurvey::factory()->open()->withGuestAccess()->create(), 'surveys.join.show'],
    'game' => [fn () => GameRoom::factory()->linkAccess()->create(), 'games.join.show'],
]);

/**
 * Each kind: the session, who may share its link, a guest's cookies, the snapshot route, the path of the code in
 * the snapshot and the route that regenerates the link.
 */
dataset('shared sessions', [
    'retro' => [function (): array {
        $retro = Retro::factory()->withGuestAccess()->create();
        [$facilitator] = retroFacilitator($retro);
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

        return [$retro, $facilitator, retroGuestCookie($guest), 'retros.snapshot.show', 'retro.joinCode', 'retros.guest-token.store'];
    }],
    'poker' => [function (): array {
        $game = PokerGame::factory()->withGuestAccess()->create();
        [$facilitator] = pokerFacilitator($game);

        return [$game, $facilitator, pokerGuestCookie(pokerGuest($game)), 'poker.snapshot.show', 'game.joinCode', 'poker.guest-token.store'];
    }],
    'whiteboard' => [function (): array {
        $board = Whiteboard::factory()->withGuestAccess()->create();
        [$facilitator] = whiteboardFacilitator($board);

        return [$board, $facilitator, whiteboardGuestCookie(whiteboardGuest($board)), 'whiteboards.snapshot.show', 'board.joinCode', 'whiteboards.guestToken.store'];
    }],
    'survey' => [function (): array {
        $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
        [$facilitator] = surveyFacilitator($survey);

        return [$survey, $facilitator, surveyGuestCookie(surveyGuest($survey)), 'surveys.snapshot.show', 'survey.joinCode', 'surveys.guestToken.store'];
    }],
    'game' => [function (): array {
        $room = GameRoom::factory()->linkAccess()->create();
        [$host] = gameRoomHost($room);

        return [$room, $host, gameGuestCookie(gameRoomGuest($room)), 'games.snapshot.show', 'room.joinCode', 'games.guest-token.store'];
    }],
]);

it('issues one code per session and keeps it', function (Closure $make) {
    $session = $make();
    $codes = resolve(JoinCodes::class);

    expect($codes->for($session))->toBe($codes->for($session))
        ->and(SessionJoinCode::query()->count())->toBe(1);
})->with('joinable sessions');

it('resolves a code to the join page while the session accepts guests', function (Closure $make, string $joinRoute) {
    $session = $make();
    $code = resolve(JoinCodes::class)->for($session);

    expect(resolve(JoinCodes::class)->resolve(strtolower(str_replace('-', '', $code))))->toBe(route($joinRoute, $session->guest_token));
})->with('joinable sessions');

it('gives a new code with a new link, and the old one stops resolving', function (Closure $make) {
    $session = $make();
    $codes = resolve(JoinCodes::class);
    $old = $codes->for($session);

    $new = $codes->rotate($session);

    expect($new)->not->toBe($old)
        ->and($codes->resolve($old))->toBeNull()
        ->and($codes->for($session))->toBe($new);
})->with('joinable sessions');

it('resolves nothing for a session that no longer accepts guests, or is gone', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $codes = resolve(JoinCodes::class);
    $code = $codes->for($retro);

    $retro->update(['guest_access_enabled' => false]);
    expect($codes->resolve($code))->toBeNull();

    $retro->delete();
    expect($codes->resolve($code))->toBeNull()
        ->and(SessionJoinCode::query()->count())->toBe(0);
});

it('resolves nothing for a draft survey, a survey of a retro, or a game room open to the team only', function (Closure $make) {
    $session = $make();

    expect(resolve(JoinCodes::class)->resolve(resolve(JoinCodes::class)->for($session)))->toBeNull();
})->with([
    'draft survey' => [fn () => TeamSurvey::factory()->draft()->withGuestAccess()->create()],
    'survey of a retro' => [fn () => TeamSurvey::factory()->open()->withGuestAccess()->create(['retro_id' => Retro::factory()->create()->id])],
    'team room' => [fn () => GameRoom::factory()->create()],
]);

it('shows the code to who sees the link, and to no guest', function (Closure $share) {
    [$session, $sharer, $guestCookie, $snapshotRoute, $path] = $share();

    $this->actingAs($sharer)->getJson(route($snapshotRoute, $session))
        ->assertOk()
        ->assertJsonPath($path, resolve(JoinCodes::class)->for($session));

    resolve('auth')->forgetGuards();

    $this->withCookies($guestCookie)->withCredentials()->getJson(route($snapshotRoute, $session))
        ->assertOk()
        ->assertJsonPath($path, null);
})->with('shared sessions');

it('returns the new code when the link is regenerated', function (Closure $share) {
    [$session, $sharer, , , , $tokenRoute] = $share();
    $old = resolve(JoinCodes::class)->for($session);

    $joinCode = $this->actingAs($sharer)->postJson(route($tokenRoute, $session))->assertOk()->json('joinCode');

    expect($joinCode)->not->toBe($old)->toBe(resolve(JoinCodes::class)->for($session));
})->with('shared sessions');
