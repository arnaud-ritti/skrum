<?php

use App\Models\GameRoom;
use App\Support\Games\ReverbGamePresenceRoster;
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
function gameRosterClient(array $responses, array &$history = []): Client
{
    $stack = HandlerStack::create(new MockHandler($responses));
    $stack->push(Middleware::history($history));

    return new Client(['handler' => $stack]);
}

it('returns the unique presence ids of the room channel', function () {
    $room = GameRoom::factory()->create();
    $history = [];
    $client = gameRosterClient([new Response(200, [], (string) json_encode([
        'users' => [['id' => 'a'], ['id' => 'a'], ['id' => 'b']],
    ]))], $history);

    expect((new ReverbGamePresenceRoster($client))->presenceIds($room))->toBe(['a', 'b']);

    $request = $history[0]['request'];

    expect($request->getUri()->getPath())->toBe("/apps/test-app/channels/presence-game.{$room->id}/users")
        ->and($history[0]['options']['timeout'])->toBe(2);
});

it('returns null and logs the room id when Reverb is unreachable', function () {
    $room = GameRoom::factory()->create();
    Log::shouldReceive('warning')->once()->with('Game presence roster unavailable.', ['room' => $room->id]);

    $client = gameRosterClient([new ConnectException('down', new Request('GET', 'x'))]);

    expect((new ReverbGamePresenceRoster($client))->presenceIds($room))->toBeNull();
});

it('returns null when the default broadcaster is not reverb', function () {
    config(['broadcasting.default' => 'null']);
    $room = GameRoom::factory()->create();
    Log::shouldReceive('warning')->once();

    $client = gameRosterClient([new Response(200, [], '{"users":[{"id":"a"}]}')]);

    expect((new ReverbGamePresenceRoster($client))->presenceIds($room))->toBeNull();
});
