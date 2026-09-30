<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PresentIntegrationDelivery;
use App\Actions\Integrations\RetroResultsRecipients;
use App\Actions\Integrations\SharePermissions;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\RetroPhase;
use App\Enums\RetroResultsAudience;
use App\Http\Controllers\Controller;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
use App\Notifications\RetroResultsNotification;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class RetroResultsEmailsController extends Controller
{
    private const CooldownSeconds = 600;

    public function __construct(
        private IntegrationAvailability $integrationAvailability,
        private SharePermissions $sharePermissions,
        private RetroResultsRecipients $retroResultsRecipients,
        private PresentIntegrationDelivery $presentIntegrationDelivery,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        abort_unless($this->integrationAvailability->emailEnabled(), 404);

        $sharer = $this->sharePermissions->ensureRetro($retro, $participant);

        $validated = $request->validate([
            'audience' => ['required', Rule::enum(RetroResultsAudience::class)],
        ]);

        if ($retro->phase !== RetroPhase::Completed) {
            throw ValidationException::withMessages(['audience' => __('Results can be shared once the retrospective is completed.')]);
        }

        $recipients = $this->retroResultsRecipients->query($retro, RetroResultsAudience::from($validated['audience']))->get();

        if ($recipients->isEmpty()) {
            throw ValidationException::withMessages(['audience' => __('Nobody can receive these results by email.')]);
        }

        $cooldownKey = "retro-results-email:{$retro->id}";

        abort_unless(Cache::add($cooldownKey, true, self::CooldownSeconds), 429, __('The results were emailed a few minutes ago.'));

        try {
            Notification::send($recipients, new RetroResultsNotification($retro->id));
        } catch (Throwable $exception) {
            Cache::forget($cooldownKey);

            throw $exception;
        }

        $delivery = IntegrationDelivery::query()->create([
            'team_id' => $retro->team_id,
            'channel' => IntegrationDeliveryChannel::Email,
            'kind' => IntegrationDeliveryKind::RetroResults,
            'subject_type' => $retro->getMorphClass(),
            'subject_id' => $retro->id,
            'requested_by_user_id' => $sharer->id,
            'status' => IntegrationDeliveryStatus::Queued,
        ]);

        $delivery->markSent($recipients->count());
        $retro->announceDeliveryChange();

        return response()->json($this->presentIntegrationDelivery->handle($delivery->load('requestedBy')), 202);
    }
}
