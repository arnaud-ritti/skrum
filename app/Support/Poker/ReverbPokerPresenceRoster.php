<?php

namespace App\Support\Poker;

use App\Contracts\PokerPresenceRoster;
use App\Models\PokerGame;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use Illuminate\Support\Facades\Log;
use Pusher\Pusher;
use RuntimeException;
use Throwable;

class ReverbPokerPresenceRoster implements PokerPresenceRoster
{
    private const TimeoutSeconds = 2;

    public function __construct(private ?ClientInterface $client = null) {}

    public function playerIds(PokerGame $game): ?array
    {
        try {
            $response = $this->pusher()->get("/channels/presence-poker.{$game->id}/users", [], true);
        } catch (Throwable) {
            Log::warning('Poker presence roster unavailable.', ['game' => $game->id]);

            return null;
        }

        $users = is_array($response) && is_array($response['users'] ?? null) ? $response['users'] : [];
        $ids = [];

        foreach ($users as $user) {
            if (is_array($user) && is_scalar($user['id'] ?? null)) {
                $ids[] = (string) $user['id'];
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * A dedicated client: a slow Reverb must not hold a vote request for the
     * broadcaster's 30 s default.
     */
    private function pusher(): Pusher
    {
        if (config('broadcasting.default') !== 'reverb') {
            throw new RuntimeException('Reverb is not the broadcaster.');
        }

        /** @var array{key: string, secret: string, app_id: string, options?: array<string, mixed>} $config */
        $config = config('broadcasting.connections.reverb');

        return new Pusher(
            (string) $config['key'],
            (string) $config['secret'],
            (string) $config['app_id'],
            [...($config['options'] ?? []), 'timeout' => self::TimeoutSeconds],
            $this->client ?? new Client(['timeout' => self::TimeoutSeconds, 'connect_timeout' => self::TimeoutSeconds]),
        );
    }
}
