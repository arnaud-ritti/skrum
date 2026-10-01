<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryStatus;
use App\Jobs\Integrations\RedeliverWebhook;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RequestWebhookRedelivery
{
    /**
     * Queues a past generic webhook delivery again (webhook redelivery spec
     * §4.2–§4.3). The original row is locked so two quick clicks cannot
     * queue two redeliveries of it.
     */
    public function handle(TeamIntegration $integration, IntegrationDelivery $original, User $requester): IntegrationDelivery
    {
        return DB::transaction(function () use ($integration, $original, $requester): IntegrationDelivery {
            $locked = IntegrationDelivery::query()->with('payload')->lockForUpdate()->findOrFail($original->id);
            $payload = $locked->payload;

            if ($payload === null) {
                abort(409, __('This delivery\'s content is no longer kept.'));
            }

            if ($locked->status === IntegrationDeliveryStatus::Queued) {
                abort(409, __('This delivery is still being sent.'));
            }

            if (! $integration->isActive()) {
                abort(409, __('Turn the webhook back on before redelivering.'));
            }

            $alreadyQueued = IntegrationDelivery::query()
                ->where('redelivery_of_id', $locked->id)
                ->where('status', IntegrationDeliveryStatus::Queued->value)
                ->exists();

            if ($alreadyQueued) {
                abort(409, __('This delivery is already being redelivered.'));
            }

            $redelivery = IntegrationDelivery::query()->create([
                'team_id' => $locked->team_id,
                'channel' => $locked->channel,
                'kind' => $locked->kind,
                'event' => $locked->event,
                'team_integration_id' => $integration->id,
                'subject_type' => $locked->subject_type,
                'subject_id' => $locked->subject_id,
                'requested_by_user_id' => $requester->id,
                'status' => IntegrationDeliveryStatus::Queued,
                'redelivery_of_id' => $locked->id,
            ]);

            $redelivery->payload()->create(['message' => $payload->message]);

            dispatch(new RedeliverWebhook($redelivery->id, app()->getLocale()))->afterCommit();

            return $redelivery;
        });
    }
}
