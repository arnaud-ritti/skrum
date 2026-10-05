<?php

use App\Actions\Sessions\ListTeamSessions;
use App\Enums\RetroPhase;
use App\Enums\SessionState;
use App\Models\Card;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Support\Sessions\SessionCursor;

function sessionsOf(Team $team, User $viewer, SessionState $state, ?string $before = null): array
{
    return resolve(ListTeamSessions::class)->handle($team, $viewer, $state, SessionCursor::parse($before));
}

function titlesIn(array $page): array
{
    return array_column($page['sessions'], 'title');
}

function playedRoom(Team $team, string $name): GameRoom
{
    $room = GameRoom::factory()->for($team)->create(['name' => $name]);
    activeGameRound($room);
    $room->forceFill(['current_round_id' => null])->save();

    return $room;
}

beforeEach(fn () => $this->travelTo(now()->startOfMinute()));

it('puts each kind in the state its stored data says', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    Retro::factory()->for($team)->create(['title' => 'retro upcoming']);
    Retro::factory()->for($team)->started()->create(['title' => 'retro started']);
    $legacy = Retro::factory()->for($team)->create(['title' => 'retro legacy with cards']);
    Card::factory()->create(['retro_id' => $legacy->id]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro done']);

    PokerGame::factory()->for($team)->create(['title' => 'poker upcoming']);
    $playing = PokerGame::factory()->for($team)->create(['title' => 'poker live']);
    openPokerRound($playing);
    PokerGame::factory()->for($team)->ended()->create(['title' => 'poker done']);

    TeamSurvey::factory()->for($team)->draft()->create(['title' => 'poll draft']);
    TeamSurvey::factory()->for($team)->open()->create(['title' => 'poll open']);
    TeamSurvey::factory()->for($team)->closed()->create(['title' => 'poll closed']);
    TeamSurvey::factory()->for($team)->open()->attachedTo(Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro with attached']))->create(['title' => 'poll attached']);

    Whiteboard::factory()->for($team)->create(['title' => 'board empty']);
    $busy = Whiteboard::factory()->for($team)->create(['title' => 'board busy']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $busy->id]);
    $this->travelTo(now()->subMinutes(16));
    $quiet = Whiteboard::factory()->for($team)->create(['title' => 'board quiet']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $quiet->id]);
    $this->travelBack();
    $this->travelTo(now()->startOfMinute());

    GameRoom::factory()->for($team)->create(['name' => 'room new']);
    $live = GameRoom::factory()->for($team)->create(['name' => 'room live']);
    activeGameRound($live);
    playedRoom($team, 'room between');
    GameRoom::factory()->icebreaker(Retro::factory()->for($team)->started()->create(['title' => 'retro with room']))->create(['name' => 'room of a retro']);

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Upcoming)))->toEqualCanonicalizing(['retro upcoming', 'poker upcoming', 'board empty', 'room new'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toEqualCanonicalizing(['retro started', 'retro legacy with cards', 'retro with room', 'poker live', 'poll open', 'board busy', 'room live'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toEqualCanonicalizing(['retro done', 'retro with attached', 'poker done', 'poll closed', 'board quiet', 'room between']);
});

it('lists a draft poll to its editors only', function () {
    $team = Team::factory()->create();
    $survey = TeamSurvey::factory()->for($team)->draft()->create(['title' => 'poll draft']);
    [$editor] = surveyFacilitator($survey);
    $other = teamMember($team);

    expect(titlesIn(sessionsOf($team, $editor, SessionState::Upcoming)))->toBe(['poll draft'])
        ->and(sessionsOf($team, $editor, SessionState::Upcoming)['sessions'][0]['isDraft'])->toBeTrue()
        ->and(titlesIn(sessionsOf($team, $other, SessionState::Upcoming)))->toBeEmpty()
        ->and(titlesIn(sessionsOf($team, workspaceManager($team->workspace), SessionState::Upcoming)))->toBe(['poll draft']);
});

it('walks 45 sessions of five kinds in pages of 20 without a duplicate or a gap', function (string $timezone) {
    config(['app.timezone' => $timezone]);
    date_default_timezone_set($timezone);

    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $start = now()->subHours(2);
    $expected = [];

    foreach (range(1, 45) as $index) {
        $this->travelTo($start->copy()->addMinutes(intdiv($index, 3)));
        $title = "s{$index}";
        $expected[] = $title;

        match ($index % 5) {
            0 => Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => $title]),
            1 => PokerGame::factory()->for($team)->ended()->create(['title' => $title]),
            2 => TeamSurvey::factory()->for($team)->closed()->create(['title' => $title]),
            3 => tap(Whiteboard::factory()->for($team)->create(['title' => $title]), fn (Whiteboard $board) => WhiteboardElement::factory()->create(['whiteboard_id' => $board->id])),
            default => playedRoom($team, $title),
        };
    }

    $this->travelTo($start->copy()->addHours(2));

    $first = sessionsOf($team, $viewer, SessionState::Finished);
    $second = sessionsOf($team, $viewer, SessionState::Finished, $first['nextCursor']);
    $third = sessionsOf($team, $viewer, SessionState::Finished, $second['nextCursor']);
    $seen = [...titlesIn($first), ...titlesIn($second), ...titlesIn($third)];

    expect(count($first['sessions']))->toBe(20)
        ->and(count($second['sessions']))->toBe(20)
        ->and(count($third['sessions']))->toBe(5)
        ->and($third['nextCursor'])->toBeNull()
        ->and($first['total'])->toBe(45)
        ->and($seen)->toHaveCount(45)
        ->and(array_unique($seen))->toHaveCount(45)
        ->and($seen)->toEqualCanonicalizing($expected);

    $flat = [...$first['sessions'], ...$second['sessions'], ...$third['sessions']];

    foreach (array_slice($flat, 1) as $position => $row) {
        $previous = $flat[$position];
        $ordered = $previous['updatedAt'] > $row['updatedAt']
            || ($previous['updatedAt'] === $row['updatedAt'] && strcmp($previous['id'], $row['id']) > 0);

        expect($ordered)->toBeTrue();
    }
})->with(['UTC', 'Europe/Paris', 'America/New_York']);

it('describes each row with the data of its kind', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $retro = Retro::factory()->for($team)->started()->inPhase(RetroPhase::Voting)->create(['title' => 'R']);
    Participant::factory()->count(2)->create(['retro_id' => $retro->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $game = PokerGame::factory()->for($team)->create(['title' => 'P']);
    PokerTask::factory()->count(3)->create(['poker_game_id' => $game->id]);
    openPokerRound($game, $game->tasks()->first());

    $rows = collect(sessionsOf($team, $viewer, SessionState::Live)['sessions'])->keyBy('title');

    expect($rows['R'])->toMatchArray(['kind' => 'retro', 'phase' => RetroPhase::Voting->label(), 'people' => 3, 'url' => route('retros.show', $retro), 'state' => 'live'])
        ->and($rows['P'])->toMatchArray(['kind' => 'poker', 'tasks' => 3, 'url' => route('poker.show', $game)]);
});

it('lists nothing of another team', function () {
    $team = Team::factory()->create();
    Retro::factory()->started()->create();

    expect(sessionsOf($team, teamMember($team), SessionState::Live)['sessions'])->toBe([]);
});

it('keeps the sessions of every kind whose title holds the search, whatever its case, and counts them', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    Retro::factory()->for($team)->started()->create(['title' => 'Sprint 42 retro']);
    Retro::factory()->for($team)->started()->create(['title' => 'Release review']);
    $poker = PokerGame::factory()->for($team)->create(['title' => 'SPRINT 43 refinement']);
    openPokerRound($poker);
    TeamSurvey::factory()->for($team)->open()->create(['title' => 'Sprint pulse']);
    TeamSurvey::factory()->for($team)->open()->create(['title' => 'Morale check']);
    $board = Whiteboard::factory()->for($team)->create(['title' => 'Sprint map']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id]);
    activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'Friday sprint quiz']));

    $page = resolve(ListTeamSessions::class)->handle($team, $viewer, SessionState::Live, search: 'sprint');

    expect(titlesIn($page))->toEqualCanonicalizing(['Sprint 42 retro', 'SPRINT 43 refinement', 'Sprint pulse', 'Sprint map', 'Friday sprint quiz'])
        ->and($page['total'])->toBe(5);
});

it('pages the sessions a search keeps without a duplicate or a gap', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    foreach (range(1, 12) as $index) {
        $this->travel(1)->minutes();
        Retro::factory()->for($team)->started()->create(['title' => "Sprint retro {$index}"]);
        TeamSurvey::factory()->for($team)->open()->create(['title' => "Sprint poll {$index}"]);
        Retro::factory()->for($team)->started()->create(['title' => "Other {$index}"]);
    }

    $list = resolve(ListTeamSessions::class);
    $first = $list->handle($team, $viewer, SessionState::Live, search: 'sprint');
    $second = $list->handle($team, $viewer, SessionState::Live, SessionCursor::parse($first['nextCursor']), search: 'sprint');
    $titles = [...titlesIn($first), ...titlesIn($second)];

    expect($first['total'])->toBe(24)
        ->and($titles)->toHaveCount(24)
        ->and(array_unique($titles))->toHaveCount(24)
        ->and($second['nextCursor'])->toBeNull();
});
