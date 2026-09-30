<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\GameRoomShares;
use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\QueueShare;
use App\Enums\GameRoomAccess;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GameSharesController extends Controller
{
    public function __construct(
        private GameRoomShares $gameRoomShares,
        private QueueShare $queueShare,
        private BuildLinkShare $buildLinkShare,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    /**
     * A missing or lost connection answers 409 from QueueShare, as the
     * retro and poker shares do (spec 6 §13).
     */
    public function store(Request $request, GameRoom $room): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);

        $sharer = $this->gameRoomShares->ensure($room, $player);

        $validated = $request->validate([
            'channel' => ['required', Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())],
            'include_guest_link' => ['sometimes', 'boolean'],
        ]);

        $channel = IntegrationDeliveryChannel::from($validated['channel']);

        abort_unless($channel->provider()?->isEnabled() ?? false, 404);

        $includeGuestLink = $request->boolean('include_guest_link');

        if ($includeGuestLink && $room->access !== GameRoomAccess::Link) {
            throw ValidationException::withMessages(['include_guest_link' => __('Guest access is off for this room.')]);
        }

        $delivery = $this->queueShare->handle(
            $room,
            $channel,
            IntegrationDeliveryKind::GameRoomLink,
            $sharer,
            $this->buildLinkShare->gameRoom($room, $sharer, $includeGuestLink),
        );

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }
}
