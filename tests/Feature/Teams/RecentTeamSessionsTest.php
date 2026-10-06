<?php

use App\Actions\Teams\ListRecentTeamSessions;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;

it('keeps the live sessions apart from the five latest others, each newest first', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);

    foreach (range(1, 6) as $day) {
        $this->travelTo(now()->addDay());
        Retro::factory()->for($team)->create(['title' => "Done {$day}", 'phase' => RetroPhase::Completed, 'completed_at' => now()]);
    }

    $this->travelTo(now()->subDays(30));

    foreach (range(1, 6) as $day) {
        $this->travelTo(now()->addDay());
        Retro::factory()->for($team)->create(['title' => "Open {$day}", 'started_at' => now()]);
    }

    $this->travelBack();
    Retro::factory()->for(Team::factory()->create())->create(['title' => 'Another team']);

    $sessions = resolve(ListRecentTeamSessions::class)->handle($team, $viewer);

    expect(array_column($sessions['live'], 'title'))->toBe(['Open 6', 'Open 5', 'Open 4', 'Open 3', 'Open 2', 'Open 1'])
        ->and(array_column($sessions['live'], 'state'))->each->toBe('live')
        ->and(array_column($sessions['recent'], 'title'))->toBe(['Done 6', 'Done 5', 'Done 4', 'Done 3', 'Done 2'])
        ->and(array_column($sessions['recent'], 'state'))->each->toBe('finished');
});

it('has no live and no recent session for a team without any', function () {
    $team = Team::factory()->create();

    expect(resolve(ListRecentTeamSessions::class)->handle($team, teamMember($team)))->toBe(['live' => [], 'recent' => []]);
});

it('gives each kind its state, participants and outcome', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $closed = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
    $author = Participant::factory()->create(['retro_id' => $closed->id]);
    Participant::factory()->count(2)->create(['retro_id' => $closed->id]);
    ActionItem::factory()->for($team)->count(2)->create(['retro_id' => $closed->id, 'created_by_participant_id' => $author->id]);
    $upcoming = Retro::factory()->for($team)->create(['started_at' => null]);
    $survey = TeamSurvey::factory()->for($team)->closed()->create();
    $board = Whiteboard::factory()->for($team)->create();
    $game = PokerGame::factory()->for($team)->ended()->create();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'estimate' => '3', 'estimated_at' => now()]);
    PokerTask::factory()->create(['poker_game_id' => $game->id]);
    PokerPlayer::factory()->count(2)->create(['poker_game_id' => $game->id]);
    PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'is_spectator' => true]);

    $rows = collect(resolve(ListRecentTeamSessions::class)->handle($team, $viewer)['recent'])->keyBy('id');

    expect($rows[$closed->id])->toMatchArray(['kind' => 'retro', 'state' => 'finished', 'participants' => 3, 'outcome' => ['kind' => 'actions', 'count' => 2]])
        ->and($rows[$upcoming->id])->toMatchArray(['state' => 'upcoming', 'outcome' => null])
        ->and($rows[$survey->id])->toMatchArray(['kind' => 'survey', 'state' => 'finished', 'outcome' => ['kind' => 'answers', 'count' => 0]])
        ->and($rows[$board->id])->toMatchArray(['kind' => 'whiteboard', 'state' => 'upcoming'])
        ->and($rows[$game->id])->toMatchArray(['kind' => 'poker', 'state' => 'finished', 'participants' => 2, 'outcome' => ['kind' => 'estimated', 'count' => 1]]);
});

it('gives an ended retro its average ROTI, and none to a retro without a vote or still open', function () {
    $team = Team::factory()->create();
    $rated = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
    $unrated = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
    $voting = Retro::factory()->for($team)->create(['phase' => RetroPhase::Roti, 'started_at' => now()]);

    foreach ([4, 4, 5] as $score) {
        RotiVote::factory()->create(['retro_id' => $rated->id, 'score' => $score]);
    }

    RotiVote::factory()->create(['retro_id' => $voting->id, 'score' => 2]);

    $sessions = resolve(ListRecentTeamSessions::class)->handle($team, teamMember($team));
    $rows = collect([...$sessions['live'], ...$sessions['recent']])->keyBy('id');

    expect($rows[$rated->id]['roti'])->toBe(4.3)
        ->and($rows[$unrated->id]['roti'])->toBeNull()
        ->and($rows[$voting->id]['roti'])->toBeNull();
});

it('reads the state of each kind by the rules of the sessions page', function () {
    $team = Team::factory()->create();
    $viewer = teamMember($team);
    $legacy = Retro::factory()->for($team)->create(['title' => 'retro with cards']);
    Card::factory()->create(['retro_id' => $legacy->id]);
    $playing = PokerGame::factory()->for($team)->create(['title' => 'poker live']);
    openPokerRound($playing);
    $survey = TeamSurvey::factory()->for($team)->open()->create(['title' => 'poll open']);
    $busy = Whiteboard::factory()->for($team)->create(['title' => 'board busy']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $busy->id]);
    $live = GameRoom::factory()->for($team)->create(['name' => 'room live']);
    activeGameRound($live);
    GamePlayer::factory()->count(2)->create(['game_room_id' => $live->id]);

    $rows = collect(resolve(ListRecentTeamSessions::class)->handle($team, $viewer)['live']);
    $states = $rows->pluck('state', 'title')->all();

    expect($states)->toEqualCanonicalizing([
        'retro with cards' => 'live',
        'poker live' => 'live',
        'poll open' => 'live',
        'board busy' => 'live',
        'room live' => 'live',
    ])
        ->and($rows->firstWhere('id', $live->id))->toMatchArray(['kind' => 'game', 'participants' => 2]);

    $this->travelTo(now()->addMinutes(16));

    $boardRow = collect(resolve(ListRecentTeamSessions::class)->handle($team, $viewer)['recent'])->firstWhere('id', $busy->id);

    expect($boardRow['state'])->toBe('finished');
});

it('shows a draft survey to its editors only', function () {
    $team = Team::factory()->create();
    $draft = TeamSurvey::factory()->for($team)->draft()->create();
    [$editor] = surveyFacilitator($draft);

    $ids = fn (User $user) => array_column(resolve(ListRecentTeamSessions::class)->handle($team, $user)['recent'], 'id');

    expect($ids($editor))->toContain($draft->id)
        ->and($ids(workspaceManager($team->workspace)))->toContain($draft->id)
        ->and($ids(teamMember($team)))->not->toContain($draft->id);
});

it('sends the two lists to the team page', function () {
    $team = Team::factory()->create();
    Retro::factory()->for($team)->create();
    Retro::factory()->for($team)->started()->create();

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn ($page) => $page->has('recentSessions', 1)->has('liveNow', 1));
});
