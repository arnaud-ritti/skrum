<?php

use App\Enums\RetroPhase;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the session of a retro guest link', function () {
    $retro = Retro::factory()->withGuestAccess()->create(['title' => 'Sprint 12']);
    $facilitator = Participant::factory()->for($retro)->create(['user_id' => User::factory()->create(['name' => 'Grace'])->id]);
    Participant::factory()->for($retro)->guest()->create();
    $retro->update(['facilitator_participant_id' => $facilitator->id]);

    $this->get(route('retros.join.show', $retro->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('session', [
                'title' => 'Sprint 12',
                'facilitatorName' => 'Grace',
                'participantsCount' => 2,
                'isLive' => true,
            ]));
});

it('sends a null facilitator name when the retro has no facilitator', function () {
    $retro = Retro::factory()->withGuestAccess()->create();

    $this->get(route('retros.join.show', $retro->guest_token))
        ->assertInertia(fn (Assert $page) => $page
            ->where('session.facilitatorName', null)
            ->where('session.participantsCount', 0));
});

it('marks a completed retro as not live', function () {
    $retro = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Completed)->create();

    $this->get(route('retros.join.show', $retro->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('session.isLive', false));
});

it('sends the session of a poker guest link', function () {
    $game = PokerGame::factory()->withGuestAccess()->create(['title' => 'Estimation']);
    $facilitator = PokerPlayer::factory()->for($game, 'game')->guest()->create(['guest_name' => 'Ada']);
    PokerPlayer::factory()->for($game, 'game')->guest()->create();
    $game->update(['facilitator_player_id' => $facilitator->id]);

    $this->get(route('poker.join.show', $game->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('session', [
                'title' => 'Estimation',
                'facilitatorName' => 'Ada',
                'participantsCount' => 2,
                'isLive' => true,
            ]));
});

it('marks an ended poker game as not live', function () {
    $game = PokerGame::factory()->withGuestAccess()->ended()->create();

    $this->get(route('poker.join.show', $game->guest_token))
        ->assertInertia(fn (Assert $page) => $page->where('session.isLive', false));
});

it('sends the session of a game guest link', function () {
    $room = GameRoom::factory()->linkAccess()->create(['name' => 'Coffee games']);
    $host = GamePlayer::factory()->for($room, 'room')->create(['user_id' => null, 'guest_name' => 'Otto']);
    $room->update(['host_player_id' => $host->id]);

    $this->get(route('games.join.show', $room->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('session', [
                'title' => 'Coffee games',
                'gameLabel' => __('Hangman'),
                'facilitatorName' => 'Otto',
                'participantsCount' => 1,
                'isLive' => true,
            ]));
});

it('sends the session of a whiteboard guest link', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Workshop']);
    $facilitator = WhiteboardMember::factory()->for($board, 'whiteboard')->guest()->create(['guest_name' => 'Lin']);
    WhiteboardMember::factory()->for($board, 'whiteboard')->guest()->create();
    $board->update(['facilitator_member_id' => $facilitator->id]);

    $this->get(route('whiteboards.join.show', $board->guest_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('session', [
                'title' => 'Workshop',
                'facilitatorName' => 'Lin',
                'participantsCount' => 2,
                'isLive' => true,
            ]));
});

it('sends no session for an unknown token or a session with guest access off', function () {
    $retro = Retro::factory()->create();
    $game = PokerGame::factory()->create();
    $room = GameRoom::factory()->create();
    $board = Whiteboard::factory()->create();

    $links = [
        ['retros.join.show', $retro->guest_token, 'retros.join.show'],
        ['poker.join.show', $game->guest_token, 'poker.join.show'],
        ['games.join.show', $room->guest_token, 'games.join.show'],
        ['whiteboards.join.show', $board->guest_token, 'whiteboards.join.show'],
    ];

    foreach ($links as [$routeName, $disabledToken]) {
        foreach (['unknown-token', $disabledToken] as $token) {
            $this->get(route($routeName, $token))
                ->assertNotFound()
                ->assertInertia(fn (Assert $page) => $page
                    ->where('isInvalid', true)
                    ->missing('session'));
        }
    }
});

it('never exposes an e-mail address of someone who joined', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $user = User::factory()->create(['email' => 'secret@example.com']);
    $participant = Participant::factory()->for($retro)->create(['user_id' => $user->id]);
    $retro->update(['facilitator_participant_id' => $participant->id]);

    $content = $this->get(route('retros.join.show', $retro->guest_token))->getContent();

    expect($content)->not->toContain('secret@example.com');
});
