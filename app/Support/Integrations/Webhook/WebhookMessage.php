<?php

namespace App\Support\Integrations\Webhook;

use App\Models\Team;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

/**
 * One webhook body (spec 8 §4.5). `id` is the delivery id, identical on every
 * retry so receivers can de-duplicate; `sentAt` changes per attempt.
 */
class WebhookMessage
{
    public const Version = 1;

    public const TestEvent = 'webhook.test';

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public string $id,
        public string $event,
        public string $occurredAt,
        public array $data,
        public bool $redelivery = false,
    ) {}

    public static function test(): self
    {
        return new self((string) Str::uuid(), self::TestEvent, now()->toIso8601ZuluString(), [
            'message' => __('skrum is connected.'),
        ]);
    }

    public function body(Team $team, CarbonInterface $sentAt): string
    {
        return json_encode([
            'version' => self::Version,
            'id' => $this->id,
            'event' => $this->event,
            'occurredAt' => $this->occurredAt,
            'sentAt' => $sentAt->toIso8601ZuluString(),
            'team' => ['id' => $team->id, 'name' => $team->name],
            'data' => $this->data,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
