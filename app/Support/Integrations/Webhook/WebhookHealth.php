<?php

namespace App\Support\Integrations\Webhook;

use App\Enums\IntegrationStatus;
use App\Models\TeamIntegration;
use Illuminate\Support\Facades\DB;

/**
 * Spec 8 §4.7: a webhook disables itself after 10 failed deliveries in a
 * row when none succeeded in the last 24 hours; any 2xx resets the count.
 */
class WebhookHealth
{
    public const FailureLimit = 10;

    public const FailuresReason = 'failures';

    public const GoneReason = 'gone';

    private const int SuccessGraceHours = 24;

    public function succeeded(TeamIntegration $integration): void
    {
        $succeededAt = now();

        TeamIntegration::query()->whereKey($integration->id)->update([
            'consecutive_failures' => 0,
            'last_delivery_succeeded_at' => $succeededAt,
        ]);

        $integration->forceFill([
            'consecutive_failures' => 0,
            'last_delivery_succeeded_at' => $succeededAt,
        ])->syncOriginal();
    }

    public function gone(TeamIntegration $integration): void
    {
        DB::transaction(function () use ($integration): void {
            $locked = TeamIntegration::query()->lockForUpdate()->find($integration->id);

            if ($locked === null) {
                return;
            }

            $locked->forceFill([
                'status' => IntegrationStatus::ReconnectRequired,
                'last_error' => __('The receiver asked skrum to stop.'),
                'settings' => [...$locked->settings, 'disabledReason' => self::GoneReason],
            ])->save();
        });

        $integration->refresh();
    }

    public function failed(TeamIntegration $integration): void
    {
        DB::transaction(function () use ($integration): void {
            $locked = TeamIntegration::query()->lockForUpdate()->find($integration->id);

            if ($locked === null) {
                return;
            }

            if (! $locked->isActive()) {
                return;
            }

            $failures = $locked->consecutive_failures + 1;
            $locked->forceFill(['consecutive_failures' => $failures]);

            if ($this->shouldDisable($locked, $failures)) {
                $locked->forceFill([
                    'status' => IntegrationStatus::ReconnectRequired,
                    'last_error' => __('Disabled after 10 failed deliveries in a row.'),
                    'settings' => [...$locked->settings, 'disabledReason' => self::FailuresReason],
                ]);
            }

            $locked->save();
        });
    }

    public function reenable(TeamIntegration $integration): void
    {
        DB::transaction(function () use ($integration): void {
            $locked = TeamIntegration::query()->lockForUpdate()->find($integration->id);

            if ($locked === null) {
                return;
            }

            $settings = $locked->settings;
            unset($settings['disabledReason']);

            $locked->forceFill([
                'status' => IntegrationStatus::Active,
                'last_error' => null,
                'consecutive_failures' => 0,
                'settings' => $settings,
            ])->save();
        });

        $integration->refresh();
    }

    private function shouldDisable(TeamIntegration $integration, int $failures): bool
    {
        if ($failures < self::FailureLimit) {
            return false;
        }

        $lastSuccess = $integration->last_delivery_succeeded_at;

        return $lastSuccess === null || $lastSuccess->lt(now()->subHours(self::SuccessGraceHours));
    }
}
