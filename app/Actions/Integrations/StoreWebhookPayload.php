<?php

namespace App\Actions\Integrations;

use App\Models\IntegrationDelivery;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class StoreWebhookPayload
{
    public const MaxBytes = 524288;

    private const EnvelopeBytes = 4096;

    /**
     * Keeps the message of a generic webhook delivery for viewing and
     * redelivery (webhook redelivery spec §3). The body sent later repeats
     * the message, so a message that would not fit twice, with its
     * envelope, in 512 KB is not kept at all. A copy made for a redelivery
     * is kept since the date of the first delivery, so it expires with it.
     *
     * @param  array{id: string, event: string, occurredAt: string, data: array<string, mixed>}  $message
     */
    public function handle(IntegrationDelivery $delivery, array $message, ?DateTimeInterface $keptSince = null): void
    {
        $size = strlen(json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        if ($size * 2 + self::EnvelopeBytes > self::MaxBytes) {
            return;
        }

        $payload = $delivery->payload()->make(['message' => $message]);

        if ($keptSince !== null) {
            $payload->setCreatedAt($keptSince);
        }

        $payload->save();
    }

    /**
     * Keeping the message is a courtesy for the delivery log: a failure
     * never stops the delivery itself, which goes on as "content not kept".
     * The savepoint leaves the caller's transaction usable, and only the
     * class of the cause is reported, since a query error's message carries
     * its bound values.
     *
     * @param  array{id: string, event: string, occurredAt: string, data: array<string, mixed>}  $message
     */
    public function keepIfPossible(IntegrationDelivery $delivery, array $message): void
    {
        try {
            DB::transaction(fn () => $this->handle($delivery, $message));
        } catch (Throwable $exception) {
            $causeName = class_basename($exception);

            report(new RuntimeException("Could not keep the webhook message of delivery {$delivery->id} ({$causeName})."));
        }
    }
}
