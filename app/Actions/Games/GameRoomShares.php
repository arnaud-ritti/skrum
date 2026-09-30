<?php

namespace App\Actions\Games;

use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\ShareOptions;
use App\Enums\IntegrationDeliveryKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Room managers who are team members invite (spec 7 §3.1, scope decision
 * 5): workspace Owners/Admins, and the host or creator while they belong
 * to the team. Guests and icebreaker rooms never invite.
 */
class GameRoomShares
{
    private const NoChannels = ['slack' => false, 'telegram' => false];

    public function __construct(
        private ShareOptions $shareOptions,
        private LatestDeliveries $latestDeliveries,
    ) {}

    public function canShare(GameRoom $room, GamePlayer $player): bool
    {
        if ($room->isIcebreaker() || $player->isGuest()) {
            return false;
        }

        $user = $player->account();

        if ($user === null) {
            return false;
        }

        if ($user->canManage($room->team->workspace)) {
            return true;
        }

        if (! $room->isHost($player) && ! $room->isCreator($player)) {
            return false;
        }

        return $room->team->hasMember($user);
    }

    public function ensure(GameRoom $room, GamePlayer $player): User
    {
        $user = $player->account();

        if ($user === null || ! $this->canShare($room, $player)) {
            throw new AuthorizationException(__('Only the host, the room creator or a workspace admin can invite people to this room.'));
        }

        return $user;
    }

    /**
     * @return array{slack: bool, telegram: bool}
     */
    public function availability(GameRoom $room, GamePlayer $player): array
    {
        if (! $this->canShare($room, $player)) {
            return self::NoChannels;
        }

        return $this->shareOptions->channels($room->team);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function deliveries(GameRoom $room, GamePlayer $player): array
    {
        if (! $this->canShare($room, $player)) {
            return [];
        }

        return $this->latestDeliveries->handle($room, [IntegrationDeliveryKind::GameRoomLink]);
    }
}
