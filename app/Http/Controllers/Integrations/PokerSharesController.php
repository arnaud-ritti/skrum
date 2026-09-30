<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\QueueShare;
use App\Actions\Integrations\SharePermissions;
use App\Actions\Poker\PokerGuard;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PokerSharesController extends Controller
{
    public function __construct(
        private SharePermissions $sharePermissions,
        private QueueShare $queueShare,
        private BuildLinkShare $buildLinkShare,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    public function store(Request $request, PokerGame $game): JsonResponse
    {
        $player = PokerPlayer::current($request);

        $validated = $request->validate([
            'channel' => ['required', Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())],
            'include_guest_link' => ['sometimes', 'boolean'],
        ]);

        $channel = IntegrationDeliveryChannel::from($validated['channel']);

        abort_unless($channel->provider()?->isEnabled() ?? false, 404);

        $sharer = $this->sharePermissions->ensurePokerGame($game, $player);
        PokerGuard::notEnded($game);

        $includeGuestLink = $request->boolean('include_guest_link');

        if ($includeGuestLink && ! $game->guest_access_enabled) {
            throw ValidationException::withMessages(['include_guest_link' => __('Guest access is off for this game.')]);
        }

        $delivery = $this->queueShare->handle(
            $game,
            $channel,
            IntegrationDeliveryKind::PokerLink,
            $sharer,
            $this->buildLinkShare->pokerGame($game, $sharer, $includeGuestLink),
        );

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }
}
