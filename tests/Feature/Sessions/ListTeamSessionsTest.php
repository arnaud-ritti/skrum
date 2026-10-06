<?php

use App\Actions\Sessions\ListTeamSessions;
use App\Enums\RetroPhase;
use App\Enums\SessionState;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GameChoice;
use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameTextAnswer;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamSprint;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Support\Sessions\SessionCursor;

function sessionsOf(Team $team, User $viewer, SessionState $state, ?string $before = null): array
{
    return resolve(ListTeamSessions::class)->handle($team, $viewer, $state, SessionCursor::parse($before));
}

function timelineOf(Team $team, User $viewer, ?string $kind = null, ?string $before = null, ?string $search = null): array
{
    return resolve(ListTeamSessions::class)->timeline($team, $viewer, $kind, SessionCursor::parse($before), search: $search);
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

it('counts a room as live only while something happened in it during the last 15 minutes', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $room = GameRoom::factory()->for($team)->create(['name' => 'quiz']);
    activeGameRound($room);

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe(['quiz'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe([]);

    $this->travel(ListTeamSessions::LiveWithinMinutes + 1)->minutes();

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe([])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe(['quiz'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Upcoming)))->toBe([]);
});

it('puts every room in exactly one state', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    GameRoom::factory()->for($team)->create(['name' => 'never played']);
    playedRoom($team, 'played, no round in play');
    activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'quiet for an hour']));
    $this->travel(1)->hours();
    activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'in play']));

    $all = [
        ...titlesIn(sessionsOf($team, $viewer, SessionState::Upcoming)),
        ...titlesIn(sessionsOf($team, $viewer, SessionState::Live)),
        ...titlesIn(sessionsOf($team, $viewer, SessionState::Finished)),
    ];

    expect($all)->toEqualCanonicalizing(['never played', 'played, no round in play', 'quiet for an hour', 'in play'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe(['in play']);
});

it('keeps a quiet room live for 15 minutes after a player answers, votes or guesses in its round', function (string $written) {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $round = activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'quiz']));
    $this->travel(1)->hours();
    $written::factory()->create(['game_round_id' => $round->id]);

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe(['quiz'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe([]);

    $this->travel(ListTeamSessions::LiveWithinMinutes + 1)->minutes();

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe([])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe(['quiz']);
})->with([
    'a GIF answer' => GameGifAnswer::class,
    'a GIF vote' => GameGifVote::class,
    'a choice' => GameChoice::class,
    'a text answer' => GameTextAnswer::class,
    'a guess' => GameGuess::class,
]);

it('keeps a quiet room live for 15 minutes after its round in play is written', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $round = activeGameRound(GameRoom::factory()->for($team)->create(['name' => 'drawing']));
    $this->travel(1)->hours();
    $round->forceFill(['drawing_points' => 12])->save();

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe(['drawing'])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe([]);

    $this->travel(ListTeamSessions::LiveWithinMinutes + 1)->minutes();

    expect(titlesIn(sessionsOf($team, $viewer, SessionState::Live)))->toBe([])
        ->and(titlesIn(sessionsOf($team, $viewer, SessionState::Finished)))->toBe(['drawing']);
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

it('lists live sessions apart and every other session below', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'live retro']);
    Retro::factory()->for($team)->create(['title' => 'retro not started']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro done']);
    PokerGame::factory()->for($team)->ended()->create(['title' => 'poker done']);

    $page = timelineOf($team, $viewer);

    expect(array_column($page['live'], 'title'))->toBe(['live retro'])
        ->and(array_column($page['live'], 'state'))->toBe(['live'])
        ->and(array_column($page['sessions'], 'title'))->toEqualCanonicalizing(['retro not started', 'retro done', 'poker done'])
        ->and(array_column($page['sessions'], 'state', 'title'))->toMatchArray(['retro not started' => 'upcoming', 'retro done' => 'finished'])
        ->and($page['total'])->toBe(3)
        ->and($page['counts'])->toBe(['all' => 4, 'retro' => 3, 'poker' => 1, 'survey' => 0, 'whiteboard' => 0, 'icebreaker' => 0])
        ->and($page['nextCursor'])->toBeNull();
});

it('keeps one kind when asked and still counts every kind', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'live retro']);
    openPokerRound(PokerGame::factory()->for($team)->create(['title' => 'live poker']));
    PokerGame::factory()->for($team)->ended()->create(['title' => 'poker done']);

    $page = timelineOf($team, $viewer, 'poker');

    expect(array_column($page['live'], 'title'))->toBe(['live poker'])
        ->and(array_column($page['sessions'], 'title'))->toBe(['poker done'])
        ->and($page['total'])->toBe(1)
        ->and($page['counts'])->toMatchArray(['all' => 3, 'retro' => 1, 'poker' => 2]);
});

it('walks 45 sessions that are not live, of five kinds and two states, in pages of 20 with no duplicate and no gap', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    Retro::factory()->for($team)->started()->create(['title' => 'live retro']);

    foreach (range(1, 9) as $index) {
        Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => "retro {$index}"]);
        PokerGame::factory()->for($team)->ended()->create(['title' => "poker {$index}"]);
        TeamSurvey::factory()->for($team)->closed()->create(['title' => "poll {$index}"]);
        Whiteboard::factory()->for($team)->create(['title' => "board {$index}"]);
        playedRoom($team, "room {$index}");
    }

    $first = timelineOf($team, $viewer);
    $second = timelineOf($team, $viewer, before: $first['nextCursor']);
    $third = timelineOf($team, $viewer, before: $second['nextCursor']);
    $ids = array_column([...$first['sessions'], ...$second['sessions'], ...$third['sessions']], 'id');

    expect($first['sessions'])->toHaveCount(20)
        ->and($second['sessions'])->toHaveCount(20)
        ->and($third['sessions'])->toHaveCount(5)
        ->and($third['nextCursor'])->toBeNull()
        ->and($ids)->toHaveCount(45)
        ->and(array_unique($ids))->toHaveCount(45)
        ->and($first['total'])->toBe(45)
        ->and(array_column($second['live'], 'title'))->toBe(['live retro']);
});

it('neither lists nor counts a draft poll its viewer may not edit', function () {
    $team = Team::factory()->create();
    TeamSurvey::factory()->for($team)->draft()->create(['title' => 'someone else\'s draft']);

    $page = timelineOf($team, teamMember($team));

    expect($page['sessions'])->toBe([])
        ->and($page['counts']['survey'])->toBe(0)
        ->and($page['counts']['all'])->toBe(0);
});

it('gives each row the sprint that holds its last change, or none', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    TeamSprint::factory()->for($team)->create(['number' => 7, 'starts_on' => now()->subDays(3)->toDateString(), 'ends_on' => now()->addDays(10)->toDateString()]);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'in the sprint']);
    $this->travel(-30)->days();
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'before the sprints']);
    $this->travelBack();

    $rows = array_column(timelineOf($team, $viewer)['sessions'], 'sprint', 'title');

    expect($rows['in the sprint'])->toBe(['number' => 7, 'startsOn' => now()->subDays(3)->toDateString(), 'endsOn' => now()->addDays(10)->toDateString()])
        ->and($rows['before the sprints'])->toBeNull();
});

it('keeps a retro\'s ROTI to itself until the retro is completed', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $voting = Retro::factory()->for($team)->inPhase(RetroPhase::Roti)->started()->create(['title' => 'voting']);
    RotiVote::factory()->create(['retro_id' => $voting->id, 'score' => 1]);

    $page = timelineOf($team, $viewer);

    expect(array_column($page['live'], 'roti', 'title'))->toBe(['voting' => null]);
});

it('carries the outcome of each kind', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro']);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 3]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);
    ActionItem::factory()->create(['retro_id' => $retro->id]);
    $game = PokerGame::factory()->for($team)->ended()->create(['title' => 'poker']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'estimate_numeric' => 21]);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'estimate_numeric' => 13]);
    $room = playedRoom($team, 'room');
    GamePlayer::factory()->count(2)->create(['game_room_id' => $room->id]);
    Whiteboard::factory()->for($team)->create(['title' => 'board']);

    $rows = array_column(timelineOf($team, $viewer)['sessions'], null, 'title');

    expect($rows['retro']['roti'])->toBe(3.5)
        ->and($rows['retro']['actions'])->toBe(1)
        ->and($rows['poker']['points'])->toBe(34.0)
        ->and($rows['poker']['tasks'])->toBe(2)
        ->and($rows['room']['people'])->toBe(2)
        ->and($rows['board'])->toMatchArray(['roti' => null, 'actions' => null, 'points' => null, 'people' => null]);
});

it('lets the facilitator and a workspace manager delete a board or a poll, and who may create a poll duplicate one', function () {
    $team = Team::factory()->create();
    $board = Whiteboard::factory()->for($team)->create(['title' => 'board']);
    [$boardFacilitator] = whiteboardFacilitator($board);
    $survey = TeamSurvey::factory()->for($team)->closed()->create(['title' => 'poll']);
    [$pollFacilitator] = surveyFacilitator($survey);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'retro']);

    $rights = fn (User $viewer): array => array_map(
        fn (array $row): array => [$row['canDelete'], $row['canDuplicate']],
        array_column(timelineOf($team, $viewer)['sessions'], null, 'title'),
    );

    expect($rights($boardFacilitator))->toEqual(['board' => [true, false], 'poll' => [false, true], 'retro' => [false, false]])
        ->and($rights($pollFacilitator))->toEqual(['board' => [false, false], 'poll' => [true, true], 'retro' => [false, false]])
        ->and($rights(workspaceManager($team->workspace)))->toEqual(['board' => [true, false], 'poll' => [true, true], 'retro' => [false, false]])
        ->and($rights(teamMember($team, TeamRole::Observer)))->toEqual(['board' => [false, false], 'poll' => [false, false], 'retro' => [false, false]]);
});
