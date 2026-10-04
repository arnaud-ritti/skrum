<?php

use App\Models\PokerGame;
use App\Support\Poker\ReverbPokerPresenceRoster;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
        'broadcasting.connections.reverb.options' => ['host' => 'reverb.test', 'port' => 8080, 'scheme' => 'http', 'useTLS' => false],
    ]);
});

/**
 * @param  array<int, mixed>  $responses
 * @param  array<int, array<string, mixed>>  $history
 */
function rosterClient(array $responses, array &$history = []): Client
{
    $stack = HandlerStack::create(new MockHandler($responses));
    $stack->push(Middleware::history($history));

    return new Client(['handler' => $stack]);
}

it('returns the unique presence ids of the game channel', function () {
    $game = PokerGame::factory()->create();
    $history = [];
    $client = rosterClient([new Response(200, [], (string) json_encode([
        'users' => [['id' => 'a'], ['id' => 'a'], ['id' => 'b']],
    ]))], $history);

    expect(new ReverbPokerPresenceRoster($client)->playerIds($game))->toBe(['a', 'b']);

    $request = $history[0]['request'];

    expect($request->getUri()->getHost())->toBe('reverb.test')
        ->and($request->getUri()->getPath())->toBe("/apps/test-app/channels/presence-poker.{$game->id}/users")
        ->and($history[0]['options']['timeout'])->toBe(2);
});

it('returns null and logs the game id when Reverb is unreachable', function () {
    $game = PokerGame::factory()->create();
    Log::shouldReceive('warning')->once()->with('Poker presence roster unavailable.', ['game' => $game->id]);

    $client = rosterClient([new ConnectException('down', new Request('GET', 'x'))]);

    expect(new ReverbPokerPresenceRoster($client)->playerIds($game))->toBeNull();
});

it('returns null on an API error', function () {
    $game = PokerGame::factory()->create();
    Log::shouldReceive('warning')->once();

    $client = rosterClient([new Response(500, [], 'boom')]);

    expect(new ReverbPokerPresenceRoster($client)->playerIds($game))->toBeNull();
});

it('returns null when the default broadcaster is not reverb', function () {
    config(['broadcasting.default' => 'null']);
    $game = PokerGame::factory()->create();
    Log::shouldReceive('warning')->once();

    $client = rosterClient([new Response(200, [], '{"users":[{"id":"a"}]}')]);

    expect(new ReverbPokerPresenceRoster($client)->playerIds($game))->toBeNull();
});
