<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\RedeliverWebhook;
use App\Models\IntegrationDelivery;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Support\Facades\DB;
use Throwable;

class RequestWebhookRedelivery
{
    /**
     * Longer than the life of any delivery job (an automatic event retries
     * for about 3.5 hours): a row still queued after that lost its job.
     */
    public const StaleQueuedHours = 4;

    public function __construct(private StoreWebhookPayload $storeWebhookPayload) {}

    /**
     * Queues a past generic webhook delivery again (webhook redelivery spec
     * §4.2–§4.3). Every redelivery points to the first delivery of its
     * message, and that row is locked, so two quick clicks anywhere in the
     * chain cannot queue the same message twice. A row whose job was lost
     * stops blocking once it is stale, and a redelivery that cannot be
     * queued ends failed instead of staying queued.
     */
    public function handle(TeamIntegration $integration, IntegrationDelivery $original, User $requester): IntegrationDelivery
    {
        $redelivery = DB::transaction(function () use ($integration, $original, $requester): IntegrationDelivery {
            $staleBefore = now()->subHours(self::StaleQueuedHours);

            $rootId = IntegrationDelivery::query()->whereKey($original->id)->value('redelivery_of_id') ?? $original->id;

            IntegrationDelivery::query()->lockForUpdate()->findOrFail($rootId);

            $source = IntegrationDelivery::query()->with('payload')->findOrFail($original->id);
            $webhook = TeamIntegration::query()->find($integration->id);

            if ($webhook === null || $webhook->provider !== IntegrationProvider::Webhook) {
                abort(404);
            }

            if ($source->team_id !== $webhook->team_id || $source->channel !== IntegrationDeliveryChannel::Webhook) {
                abort(404);
            }

            $payload = $source->payload;

            if ($payload === null) {
                abort(409, __('This delivery\'s content is no longer kept.'));
            }

            $stillBeingSent = $source->status === IntegrationDeliveryStatus::Queued
                && $source->created_at?->greaterThan($staleBefore);

            if ($stillBeingSent) {
                abort(409, __('This delivery is still being sent.'));
            }

            if (! $webhook->isActive()) {
                abort(409, __('Turn the webhook back on before redelivering.'));
            }

            $alreadyQueued = IntegrationDelivery::query()
                ->where('redelivery_of_id', $rootId)
                ->where('status', IntegrationDeliveryStatus::Queued->value)
                ->where('created_at', '>', $staleBefore)
                ->exists();

            if ($alreadyQueued) {
                abort(409, __('This delivery is already being redelivered.'));
            }

            $redelivery = IntegrationDelivery::query()->create([
                'team_id' => $source->team_id,
                'channel' => $source->channel,
                'kind' => $source->kind,
                'event' => $source->event,
                'team_integration_id' => $webhook->id,
                'subject_type' => $source->subject_type,
                'subject_id' => $source->subject_id,
                'requested_by_user_id' => $requester->id,
                'status' => IntegrationDeliveryStatus::Queued,
                'redelivery_of_id' => $rootId,
            ]);

            $this->storeWebhookPayload->handle($redelivery, $payload->message, $payload->created_at);

            return $redelivery;
        });

        try {
            app(Dispatcher::class)->dispatch((new RedeliverWebhook($redelivery->id, app()->getLocale()))->afterCommit());
        } catch (Throwable $exception) {
            report($exception);

            $redelivery->markFailed(__('The message could not be delivered.'));
        }

        return $redelivery;
    }
}
