<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\BuildLinkShare;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\QueueShare;
use App\Actions\Integrations\SharePermissions;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Integrations\Messages\RetroRecapContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RetroSharesController extends Controller
{
    private const LinkKind = 'link';

    private const ResultsKind = 'results';

    public function __construct(
        private SharePermissions $sharePermissions,
        private QueueShare $queueShare,
        private BuildLinkShare $buildLinkShare,
        private BuildRetroRecap $buildRetroRecap,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $sharer = $this->sharePermissions->ensureRetro($retro, Participant::current($request));

        $validated = $request->validate([
            'channel' => ['required', Rule::enum(IntegrationDeliveryChannel::class)->only(IntegrationDeliveryChannel::shareChannels())],
            'kind' => ['required', Rule::in([self::LinkKind, self::ResultsKind])],
            'include_guest_link' => ['sometimes', 'boolean'],
        ]);

        $channel = IntegrationDeliveryChannel::from($validated['channel']);

        abort_unless($channel->provider()?->isEnabled() ?? false, 404);

        $isResults = $validated['kind'] === self::ResultsKind;
        $includeGuestLink = ! $isResults && $request->boolean('include_guest_link');

        $this->ensurePhase($retro, $isResults);

        if ($includeGuestLink && ! $retro->guest_access_enabled) {
            throw ValidationException::withMessages(['include_guest_link' => __('Guest access is off for this retrospective.')]);
        }

        $delivery = $this->queueShare->handle(
            $retro,
            $channel,
            $isResults ? IntegrationDeliveryKind::RetroResults : IntegrationDeliveryKind::RetroLink,
            $sharer,
            $isResults
                ? new RetroRecapContent($this->buildRetroRecap->handle($retro))
                : $this->buildLinkShare->retro($retro, $sharer, $includeGuestLink),
        );

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }

    private function ensurePhase(Retro $retro, bool $isResults): void
    {
        $isCompleted = $retro->phase === RetroPhase::Completed;

        if ($isResults && ! $isCompleted) {
            throw ValidationException::withMessages(['kind' => __('Results can be shared once the retrospective is completed.')]);
        }

        if (! $isResults && $isCompleted) {
            throw ValidationException::withMessages(['kind' => __('This retrospective is completed. Share its results instead.')]);
        }
    }
}
