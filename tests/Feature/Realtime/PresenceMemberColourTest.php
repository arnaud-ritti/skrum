<?php

use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    fakeGameRoster([]);
});

/**
 * @return array<string, mixed>
 */
function presenceMemberData(mixed $test, string $channel): array
{
    $response = $test->postJson(route('broadcasting.auth'), ['socket_id' => '1234.5678', 'channel_name' => $channel])->assertOk();

    return json_decode($response->json('channel_data'), true)['user_info'];
}

it('sends a member colour on the retro channel', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $user->update(['presence_color' => 3]);

    $this->actingAs($user);

    expect(presenceMemberData($this, "presence-retro.{$retro->id}")['presence'])->toBe(3);
});

it('sends the colour a guest picked on the poker channel', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);
    $guest->update(['presence_color' => 11]);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials();

    expect(presenceMemberData($this, "presence-poker.{$game->id}")['presence'])->toBe(11);
});

it('sends the colour a guest picked on the survey channel', function () {
    $survey = TeamSurvey::factory()->open()->withGuestAccess()->create();
    $guest = surveyGuest($survey);
    $guest->update(['presence_color' => 6]);

    $this->withCookies(surveyGuestCookie($guest))->withCredentials();

    expect(presenceMemberData($this, "presence-survey.{$survey->id}")['presence'])->toBe(6);
});

it('sends the colour a guest picked on the game channel', function () {
    $room = GameRoom::factory()->linkAccess()->create();
    $guest = gameRoomGuest($room);
    $guest->update(['presence_color' => 2]);

    $this->withCookies(gameGuestCookie($guest))->withCredentials();

    expect(presenceMemberData($this, "presence-game.{$room->id}")['presence'])->toBe(2);
});

it('derives a colour for a guest who picked none', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials();

    expect(presenceMemberData($this, "presence-poker.{$game->id}")['presence'])->toBe($guest->presenceColor())
        ->toBeBetween(1, 12);
});

it('gives one person the same colour on two whiteboards', function () {
    $first = Whiteboard::factory()->create();
    $second = Whiteboard::factory()->create(['team_id' => $first->team_id]);
    $user = teamMember($first->team);

    $this->actingAs($user);

    expect(presenceMemberData($this, "presence-whiteboard.{$first->id}")['presence'])
        ->toBe(presenceMemberData($this, "presence-whiteboard.{$second->id}")['presence'])
        ->toBe($user->presenceColor());
});

it('gives a member the colour of the account, not one stored on the row', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $user->update(['presence_color' => 5]);
    $participant->update(['presence_color' => 10]);

    expect($participant->fresh()->presenceColor())->toBe(5);
});

it('gives an icebreaker player the colour of its participant', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $participant->user->update(['presence_color' => 8]);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $player = $room->players()->create(['participant_id' => $participant->id]);

    expect($player->presenceColor())->toBe(8);
});

it('gives a guest icebreaker player the colour its participant picked', function () {
    $retro = Retro::factory()->create();
    $participant = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'presence_color' => 12]);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $player = $room->players()->create(['participant_id' => $participant->id, 'presence_color' => 1]);

    expect($player->presenceColor())->toBe(12);
});
