<?php

namespace App\Support\Games;

use App\Contracts\GamePresenceRoster;
use App\Models\GameRoom;
use App\Support\Integrations\IntegrationErrors;
use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Pusher\Pusher;
use Throwable;

class ReverbGamePresenceRoster implements GamePresenceRoster
{
    private const int TimeoutSeconds = 2;

    public function __construct(private ?ClientInterface $client = null) {}

    /**
     * Without Reverb as the broadcaster there is no roster to read, and no cap on the room.
     */
    public function presenceIds(GameRoom $room): ?array
    {
        if (config('broadcasting.default') !== 'reverb') {
            return null;
        }

        try {
            $response = $this->pusher()->get("/channels/presence-game.{$room->id}/users", [], true);
        } catch (Throwable $exception) {
            Log::warning('Game presence roster unavailable.', [
                'room' => $room->id,
                'error' => $exception::class,
                'message' => Str::limit(IntegrationErrors::sanitize($exception->getMessage()), 300),
            ]);

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
     * A dedicated client: a slow Reverb must not hold the channel
     * authorization for the broadcaster's 30 s default.
     */
    private function pusher(): Pusher
    {
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
