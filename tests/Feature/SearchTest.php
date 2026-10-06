<?php

use App\Actions\Search\SearchWorkspaceContent;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
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
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Tests\Support\SqlProbe;

function searchTitles(User $user, string $term): array
{
    return test()->actingAs($user)->getJson(route('search.index', ['q' => $term]))->assertOk()->json('results.*.title');
}

it('finds each kind of content of a visible team', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $retro = Retro::factory()->for($team)->create(['title' => 'Kraken retro']);
    $game = PokerGame::factory()->for($team)->create(['title' => 'Kraken poker']);
    $board = Whiteboard::factory()->for($team)->create(['title' => 'Kraken board']);
    $room = GameRoom::factory()->for($team)->create(['name' => 'Kraken room']);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Feed the kraken']);

    $results = $this->actingAs($user)->getJson(route('search.index', ['q' => 'KRAKEN']))->assertOk()->json('results');

    expect(array_column($results, 'kind'))->toBe(['retro', 'poker', 'whiteboard', 'game', 'action'])
        ->and(array_column($results, 'id'))->toBe([$retro->id, $game->id, $board->id, $room->id, $item->id])
        ->and($results[0])->toBe([
            'kind' => 'retro',
            'id' => $retro->id,
            'title' => 'Kraken retro',
            'team' => ['id' => $team->id, 'name' => 'Atlas'],
            'url' => route('retros.show', $retro),
            'context' => null,
        ])
        ->and($results[1]['url'])->toBe(route('poker.show', $game))
        ->and($results[2]['url'])->toBe(route('whiteboards.show', $board))
        ->and($results[3]['url'])->toBe(route('games.show', $room))
        ->and($results[4]['url'])->toBe(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $item->id]));
});

it('finds a team survey by its title once it is open or closed, never a draft nor the survey of a retro', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $open = TeamSurvey::factory()->for($team)->open()->create(['title' => 'Kraken pulse']);
    TeamSurvey::factory()->for($team)->closed()->create(['title' => 'Kraken past']);
    TeamSurvey::factory()->for($team)->draft()->create(['title' => 'Kraken draft']);
    TeamSurvey::factory()->for($team)->open()->create(['title' => 'Kraken health', 'retro_id' => Retro::factory()->for($team)->create(['title' => 'Sprint 1'])->id]);

    $results = collect($this->actingAs($user)->getJson(route('search.index', ['q' => 'kraken']))->assertOk()->json('results'));

    expect($results->pluck('title')->sort()->values()->all())->toBe(['Kraken past', 'Kraken pulse'])
        ->and($results->firstWhere('title', 'Kraken pulse'))->toBe([
            'kind' => 'survey',
            'id' => $open->id,
            'title' => 'Kraken pulse',
            'team' => ['id' => $team->id, 'name' => $team->name],
            'url' => route('surveys.show', $open),
            'context' => null,
        ]);
});

it('finds a poker game by the title of one of its tasks', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $game = PokerGame::factory()->for($team)->create(['title' => 'Sprint 12']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Migrate the kraken']);

    expect(searchTitles($user, 'kraken'))->toBe(['Sprint 12']);
});

it('never returns a team the user cannot view in the same workspace', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $otherTeam = Team::factory()->for($team->workspace)->create();
    Retro::factory()->for($otherTeam)->create(['title' => 'Kraken secret']);
    GameRoom::factory()->for($otherTeam)->create(['name' => 'Kraken open room', 'access' => 'link']);
    ActionItem::factory()->withoutRetro($otherTeam, teamMember($otherTeam))->create(['content' => 'Kraken secret action']);

    expect(searchTitles($user, 'kraken'))->toBeEmpty();
});

it('lets a workspace admin see every team of that workspace and nothing of another', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    $admin->forceFill(['current_workspace_id' => $workspace->id])->save();
    Retro::factory()->for(Team::factory()->for($workspace))->create(['title' => 'Kraken here']);
    $elsewhere = Team::factory()->create();
    $elsewhere->workspace->members()->attach($admin, ['role' => WorkspaceRole::Member->value]);
    $elsewhere->members()->attach($admin);
    Retro::factory()->for($elsewhere)->create(['title' => 'Kraken elsewhere']);

    expect(searchTitles($admin, 'kraken'))->toBe(['Kraken here']);
});

it('drops the results of a team the user left', function () {
    [$user, $team] = memberInCurrentWorkspace();
    Retro::factory()->for($team)->create(['title' => 'Kraken retro']);
    expect(searchTitles($user, 'kraken'))->toBe(['Kraken retro']);

    $team->members()->detach($user);

    expect(searchTitles($user, 'kraken'))->toBeEmpty();
});

it('returns nothing without a current workspace', function () {
    $user = User::factory()->create();

    expect(searchTitles($user, 'kraken'))->toBeEmpty();
});

it('does not find the card of someone else while the retro still hides cards', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $retro = Retro::factory()->for($team)->create(['title' => 'Sprint 12']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'kraken on a card']);

    expect(searchTitles($user, 'kraken'))->toBeEmpty();
});

it('treats pattern characters as text', function (string $term, array $expected) {
    [$user, $team] = memberInCurrentWorkspace();
    Retro::factory()->for($team)->create(['title' => '100% done_now \\o/']);
    Retro::factory()->for($team)->create(['title' => 'Plain title']);

    expect(searchTitles($user, $term))->toBe($expected);
})->with([
    ['%%', []],
    ['0%', ['100% done_now \\o/']],
    ['e_n', ['100% done_now \\o/']],
    ['__', []],
    ['\\o', ['100% done_now \\o/']],
    ["'; drop table retros; --", []],
]);

it('refuses a term that is too short, empty or too long', function (mixed $term) {
    [$user] = memberInCurrentWorkspace();

    $this->actingAs($user)->getJson(route('search.index', ['q' => $term]))->assertUnprocessable()->assertJsonValidationErrors('q');
})->with(['a', '', '   ', str_repeat('a', 101), [['kraken']]]);

it('accepts an emoji and a two-character term', function () {
    [$user, $team] = memberInCurrentWorkspace();
    Retro::factory()->for($team)->create(['title' => 'Rétro 🚀 Élan']);

    expect(searchTitles($user, '🚀 É'))->toBe(['Rétro 🚀 Élan'])
        ->and(searchTitles($user, 'ré'))->toBe(['Rétro 🚀 Élan']);
});

it('returns five results per kind, newest first', function () {
    [$user, $team] = memberInCurrentWorkspace();
    foreach (range(1, 7) as $number) {
        Retro::factory()->for($team)->create(['title' => "Kraken {$number}", 'created_at' => now()->addMinutes($number)]);
    }

    expect(searchTitles($user, 'kraken'))->toBe(['Kraken 7', 'Kraken 6', 'Kraken 5', 'Kraken 4', 'Kraken 3']);
});

it('is closed to guests and unverified accounts', function () {
    $this->getJson(route('search.index', ['q' => 'kraken']))->assertUnauthorized();
    $this->get(route('search.index', ['q' => 'kraken']))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->unverified()->create())->getJson(route('search.index', ['q' => 'kraken']))->assertForbidden();
});

it('allows sixty searches a minute', function () {
    [$user] = memberInCurrentWorkspace();

    foreach (range(1, 60) as $attempt) {
        $this->actingAs($user)->getJson(route('search.index', ['q' => 'kraken']))->assertOk();
    }

    $this->actingAs($user)->getJson(route('search.index', ['q' => 'kraken']))->assertTooManyRequests();
});

it('finds the text of a card everyone may read, and of nobody else\'s hidden card', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $other = teamMember($team);
    $revealed = Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 42']);
    $writing = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 43']);
    $participantOf = fn (Retro $retro, User $member): Participant => Participant::factory()->for($retro)->create(['user_id' => $member->id]);
    $shown = Card::factory()->for($revealed)->create(['content' => 'The flaky checkout test', 'participant_id' => $participantOf($revealed, $other)->id]);
    $hidden = Card::factory()->for($writing)->create(['content' => 'A flaky secret', 'participant_id' => $participantOf($writing, $other)->id]);
    $own = Card::factory()->for($writing)->create(['content' => 'My flaky idea', 'participant_id' => $participantOf($writing, $user)->id]);

    $results = collect($this->actingAs($user)->getJson(route('search.index', ['q' => 'flaky']))->assertOk()->json('results'))
        ->where('kind', 'card');

    expect($results->pluck('id')->all())->toEqualCanonicalizing([$shown->id, $own->id])
        ->and($results->pluck('id'))->not->toContain($hidden->id)
        ->and($results->firstWhere('id', $shown->id))->toMatchArray([
            'title' => 'The flaky checkout test',
            'context' => 'Sprint 42',
            'url' => route('retros.show', $revealed),
        ])
        ->and(json_encode($results->all()))->not->toContain($other->name);
});

it('never returns a card of a team the user cannot view', function () {
    [$user] = memberInCurrentWorkspace();
    $elsewhere = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    Card::factory()->for($elsewhere)->create(['content' => 'The flaky checkout test']);

    $this->actingAs($user)->getJson(route('search.index', ['q' => 'flaky']))
        ->assertOk()
        ->assertJsonMissing(['kind' => 'card']);
});

it('treats pattern characters as text in every kind of content', function () {
    [$user, $team] = memberInCurrentWorkspace();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create(['title' => 'Plain retro']);
    $matchedByTask = PokerGame::factory()->for($team)->create(['title' => 'Estimates']);
    PokerTask::factory()->create(['poker_game_id' => $matchedByTask->id, 'title' => 'Reach 100% coverage']);
    $nearMissByTask = PokerGame::factory()->for($team)->create(['title' => 'Near miss']);
    PokerTask::factory()->create(['poker_game_id' => $nearMissByTask->id, 'title' => 'Ticket 1000']);
    PokerGame::factory()->for($team)->create(['title' => 'Game 100% sure']);
    PokerGame::factory()->for($team)->create(['title' => 'Game 1001']);
    Whiteboard::factory()->for($team)->create(['title' => 'Board 100% drawn']);
    Whiteboard::factory()->for($team)->create(['title' => 'Board 1002']);
    GameRoom::factory()->for($team)->create(['name' => 'Room 100% fun']);
    GameRoom::factory()->for($team)->create(['name' => 'Room 1003']);
    ActionItem::factory()->create(['team_id' => $team->id, 'retro_id' => $retro->id, 'content' => 'Ship 100% of it']);
    ActionItem::factory()->create(['team_id' => $team->id, 'retro_id' => $retro->id, 'content' => 'Ship 1004 things']);
    Card::factory()->for($retro)->create(['content' => 'We did 100% of it']);
    Card::factory()->for($retro)->create(['content' => 'We did 1005 things']);

    expect(searchTitles($user, '100%'))->toEqualCanonicalizing([
        'Estimates',
        'Game 100% sure',
        'Board 100% drawn',
        'Room 100% fun',
        'Ship 100% of it',
        'We did 100% of it',
    ]);
});

it('finds a match that is older than more near misses than a kind shows', function () {
    [$user, $team] = memberInCurrentWorkspace();
    Retro::factory()->for($team)->create(['title' => 'Budget 100% spent', 'created_at' => now()->subDay()]);
    Retro::factory()->for($team)->count(SearchWorkspaceContent::PerKind + 1)->sequence(fn ($sequence): array => ['title' => "Budget 100{$sequence->index}"])->create();

    expect(searchTitles($user, '100%'))->toBe(['Budget 100% spent']);
});

it('reads the tasks of the games on a page at once when the term holds a pattern character', function () {
    [$user, $team] = memberInCurrentWorkspace();
    PokerGame::factory()->for($team)->count(4)->create(['title' => 'Near miss'])
        ->each(fn (PokerGame $game) => PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Ticket 1000']));
    $matchedByTask = PokerGame::factory()->for($team)->create(['title' => 'Estimates', 'created_at' => now()->subDay()]);
    PokerTask::factory()->create(['poker_game_id' => $matchedByTask->id, 'title' => 'Reach 100% coverage']);
    $games = DB::connection()->getQueryGrammar()->wrapTable('poker_games');
    $titles = [];

    $taskReads = array_filter(
        SqlProbe::statementsOn('poker_tasks', function () use ($user, &$titles): void {
            $titles = searchTitles($user, '100%');
        }),
        fn (string $sql): bool => ! str_contains($sql, $games),
    );

    expect($titles)->toBe(['Estimates'])
        ->and($taskReads)->toHaveCount(1);
});
