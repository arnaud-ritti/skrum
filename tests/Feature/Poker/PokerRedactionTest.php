<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Events\Poker\PokerVoteChanged;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<array-key, mixed>|string  $payload
 */
function pokerPayloadMentions(array|string $payload, string $value): bool
{
    $json = pokerPayloadJson($payload);

    return str_contains($json, "\"value\":\"{$value}\"") || str_contains($json, "\"myVote\":\"{$value}\"");
}

function pokerViewerRequest(TestCase $test, User|PokerPlayer $viewer): TestCase
{
    if ($viewer instanceof User) {
        return $test->actingAs($viewer);
    }

    app('auth')->forgetGuards();

    return $test->withCookies(pokerGuestCookie($viewer))->withCredentials();
}

/**
 * @return array{
 *     game: PokerGame,
 *     task: PokerTask,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer,
 *     guest: PokerPlayer,
 *     values: array<string, string>
 * }
 */
function redactionTable(): array
{
    $table = pokerRevealTable();
    $guest = pokerGuest($table['game']);

    return [
        'game' => $table['game'],
        'task' => $table['round']->task,
        'facilitator' => $table['facilitator'],
        'facilitatorPlayer' => $table['facilitatorPlayer'],
        'member' => $table['member'],
        'memberPlayer' => $table['memberPlayer'],
        'guest' => $guest,
        'values' => [
            $table['facilitatorPlayer']->id => '8',
            $table['memberPlayer']->id => '13',
            $guest->id => '3',
        ],
    ];
}

/**
 * Every surface a viewer can read while the round is open.
 *
 * @return array<string, array<array-key, mixed>|string>
 */
function pokerSurfacesFor(TestCase $test, array $table, User|PokerPlayer $viewer, PokerPlayer $viewerPlayer): array
{
    $game = $table['game']->fresh();

    $surfaces = [
        'built snapshot' => app(BuildPokerSnapshot::class)->handle($game, $viewerPlayer->fresh()),
        'snapshot endpoint' => pokerViewerRequest($test, $viewer)->getJson(route('poker.snapshot.show', $game))->assertOk()->getContent(),
        'page props' => pokerViewerRequest($test, $viewer)->get(route('poker.show', $game))->assertOk()->viewData('page')['props'],
        'round history' => pokerViewerRequest($test, $viewer)->getJson(route('poker.tasks.rounds.index', [$game, $table['task']]))->assertOk()->getContent(),
    ];

    if ($viewer instanceof User) {
        $surfaces['estimates page'] = $test->actingAs($viewer)
            ->get(route('teams.estimates.index', ['workspace' => $game->team->workspace, 'team' => $game->team]))
            ->assertOk()
            ->viewData('page')['props'];
    }

    return $surfaces;
}

/**
 * @return array<int, array{0: User|PokerPlayer, 1: PokerPlayer}>
 */
function pokerViewers(array $table): array
{
    return [
        [$table['facilitator'], $table['facilitatorPlayer']],
        [$table['member'], $table['memberPlayer']],
        [$table['guest'], $table['guest']],
    ];
}

it('never shows another player\'s value before reveal, on any surface, for the facilitator too', function () {
    $table = redactionTable();
    $round = $table['game']->fresh()->latestRoundOfCurrentTask();

    /** @var array<string, TestResponse> $voteResponses */
    $voteResponses = [];

    foreach (pokerViewers($table) as [$viewer, $player]) {
        $voteResponses[$player->id] = pokerViewerRequest($this, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$table['game'], $round]), ['value' => $table['values'][$player->id]])
            ->assertOk();
    }

    $players = [$table['facilitatorPlayer'], $table['memberPlayer'], $table['guest']];

    foreach (pokerViewers($table) as [$viewer, $viewerPlayer]) {
        $others = array_filter($players, fn (PokerPlayer $player) => $player->id !== $viewerPlayer->id);

        foreach ($others as $other) {
            $otherValue = $table['values'][$other->id];

            expect(pokerPayloadMentions($voteResponses[$viewerPlayer->id]->getContent(), $otherValue))
                ->toBeFalse("vote response of {$viewerPlayer->id} mentions {$otherValue}");

            foreach (pokerSurfacesFor($this, $table, $viewer, $viewerPlayer) as $surface => $payload) {
                expect(pokerPayloadExposes($payload, $other, $otherValue))->toBeFalse("{$surface} exposes {$other->id}")
                    ->and(pokerPayloadMentions($payload, $otherValue))->toBeFalse("{$surface} mentions {$otherValue}");
            }
        }
    }

    $withdrawn = pokerViewerRequest($this, $table['member'])
        ->deleteJson(route('poker.rounds.vote.destroy', [$table['game'], $round]))
        ->assertOk()
        ->assertJsonPath('myVote', null);

    foreach (['8', '13', '3'] as $value) {
        expect(pokerPayloadMentions($withdrawn->getContent(), $value))->toBeFalse();
    }

    $broadcasts = collect(Event::dispatched(PokerVoteChanged::class))
        ->map(fn (array $arguments) => $arguments[0]->broadcastWith());

    expect($broadcasts)->toHaveCount(4);

    foreach ($broadcasts as $payload) {
        expect(array_keys($payload))->toBe(['roundId', 'playerId', 'hasVoted', 'votesCount', 'version']);

        foreach (['8', '13', '3'] as $value) {
            expect(pokerPayloadMentions($payload, $value))->toBeFalse()
                ->and(in_array($value, $payload, true))->toBeFalse();
        }
    }
});

it('shows every value to every player after reveal', function () {
    $table = redactionTable();
    $round = $table['game']->fresh()->latestRoundOfCurrentTask();
    $players = [$table['facilitatorPlayer'], $table['memberPlayer'], $table['guest']];

    foreach (pokerViewers($table) as [$viewer, $player]) {
        pokerViewerRequest($this, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$table['game'], $round]), ['value' => $table['values'][$player->id]])
            ->assertOk();
    }

    $reveal = pokerViewerRequest($this, $table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$table['game'], $round]))
        ->assertOk();

    foreach ($players as $player) {
        expect(pokerPayloadExposes($reveal->getContent(), $player, $table['values'][$player->id]))->toBeTrue();
    }

    foreach (pokerViewers($table) as [$viewer, $viewerPlayer]) {
        $surfaces = pokerSurfacesFor($this, $table, $viewer, $viewerPlayer);

        foreach (['built snapshot', 'snapshot endpoint', 'page props', 'round history'] as $surface) {
            foreach ($players as $player) {
                expect(pokerPayloadExposes($surfaces[$surface], $player, $table['values'][$player->id]))
                    ->toBeTrue("{$surface} hides {$player->id} from {$viewerPlayer->id}");
            }
        }
    }
});

it('never exposes a round left unrevealed, even after the task is estimated from an earlier round', function () {
    $table = redactionTable();
    $game = $table['game'];
    $first = $game->fresh()->latestRoundOfCurrentTask();
    pokerVote($first, $table['facilitatorPlayer'], '5');
    pokerVote($first, $table['memberPlayer'], '5');

    $this->actingAs($table['facilitator'])
        ->postJson(route('poker.rounds.reveal.store', [$game, $first]))
        ->assertOk();
    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.tasks.estimate.update', [$game, $table['task']]), ['value' => '5'])
        ->assertOk();

    $second = PokerRound::query()->whereKey(
        $this->actingAs($table['facilitator'])
            ->postJson(route('poker.tasks.rounds.store', [$game, $table['task']]))
            ->assertCreated()
            ->json('id'),
    )->firstOrFail();

    foreach (pokerViewers($table) as [$viewer, $player]) {
        pokerViewerRequest($this, $viewer)
            ->putJson(route('poker.rounds.vote.update', [$game, $second]), ['value' => $table['values'][$player->id]])
            ->assertOk();
    }

    $next = PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $this->actingAs($table['facilitator'])
        ->putJson(route('poker.current-task.update', $game), ['task_id' => $next->id])
        ->assertNoContent();

    expect($second->fresh()->revealed_at)->toBeNull()
        ->and($table['task']->fresh()->estimate)->toBe('5');

    $players = [$table['facilitatorPlayer'], $table['memberPlayer'], $table['guest']];

    foreach (pokerViewers($table) as [$viewer, $viewerPlayer]) {
        foreach (pokerSurfacesFor($this, $table, $viewer, $viewerPlayer) as $surface => $payload) {
            foreach ($players as $player) {
                if ($player->id === $viewerPlayer->id) {
                    continue;
                }

                expect(pokerPayloadExposes($payload, $player, $table['values'][$player->id]))->toBeFalse("{$surface} exposes {$player->id}")
                    ->and(pokerPayloadMentions($payload, $table['values'][$player->id]))->toBeFalse("{$surface} mentions a hidden value");
            }
        }
    }
});
