<?php

namespace App\Support\Maintenance;

use App\Models\User;
use App\Support\InstanceSettings;

class MaintenanceDetails
{
    public const string PayloadKey = 'skrum';

    public function __construct(private InstanceSettings $settings) {}

    /**
     * Runs while the database is still reachable, right after `artisan down` wrote its payload.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function attachTo(array $payload): array
    {
        $authorId = $this->settings->maintenanceMessageBy();
        $retry = $payload['retry'] ?? null;

        return [...$payload, self::PayloadKey => [
            'message' => $this->settings->maintenanceMessage(),
            'author' => $authorId === null ? null : $this->authorName($authorId),
            'backAt' => is_int($retry) && $retry > 0 ? now('UTC')->addSeconds($retry)->toIso8601String() : null,
        ]];
    }

    /**
     * Read by the static 503 page: no database, and nothing thrown.
     *
     * @return ?array{message: ?string, author: ?string, backAt: ?string}
     */
    public function read(): ?array
    {
        return rescue(function (): ?array {
            if (! app()->isDownForMaintenance()) {
                return null;
            }

            $details = app()->maintenanceMode()->data()[self::PayloadKey] ?? null;

            if (! is_array($details)) {
                return null;
            }

            return [
                'message' => $this->stringOrNull($details['message'] ?? null),
                'author' => $this->stringOrNull($details['author'] ?? null),
                'backAt' => $this->stringOrNull($details['backAt'] ?? null),
            ];
        }, null, report: false);
    }

    private function authorName(string $authorId): ?string
    {
        return $this->stringOrNull(User::query()->whereKey($authorId)->value('name'));
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }
}
