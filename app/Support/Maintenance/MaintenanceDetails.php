<?php

namespace App\Support\Maintenance;

class MaintenanceDetails
{
    public const string PayloadKey = 'skrum';

    /**
     * Runs right after `artisan down` wrote its payload.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function attachTo(array $payload): array
    {
        $retry = $payload['retry'] ?? null;

        return [...$payload, self::PayloadKey => [
            'backAt' => is_int($retry) && $retry > 0 ? now('UTC')->addSeconds($retry)->toIso8601String() : null,
        ]];
    }

    /**
     * Read by the static 503 page: no database, and nothing thrown.
     *
     * @return ?array{backAt: ?string}
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

            return ['backAt' => $this->stringOrNull($details['backAt'] ?? null)];
        }, null, report: false);
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }
}
