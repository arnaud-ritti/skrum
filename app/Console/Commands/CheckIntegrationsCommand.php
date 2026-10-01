<?php

namespace App\Console\Commands;

use App\Actions\Integrations\CheckIntegration;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Console\Command;

class CheckIntegrationsCommand extends Command
{
    protected $signature = 'skrum:check-integrations';

    protected $description = 'Check that every active team integration still has access';

    public function handle(CheckIntegration $checkIntegration, TrackerWebhooks $trackerWebhooks): int
    {
        $providers = array_map(fn (IntegrationProvider $provider): string => $provider->value, IntegrationProvider::enabled());
        $counts = ['checked' => 0, 'ok' => 0, 'reconnect' => 0, 'unreachable' => 0];

        TeamIntegration::query()
            ->where('status', IntegrationStatus::Active->value)
            ->whereIn('provider', $providers)
            ->lazyById()
            ->each(function (TeamIntegration $integration) use ($checkIntegration, $trackerWebhooks, &$counts): void {
                $this->info("Checking {$integration->provider->label()} integration `{$integration->id}`…");
                $counts['checked']++;

                try {
                    $checkIntegration->handle($integration);

                    if (StatusSync::isOn($integration)) {
                        ReadTrackedIssues::dispatch($integration->id, true);
                    }

                    if (StatusSync::isOn($integration) && $trackerWebhooks->expiresSoon($integration)) {
                        RegisterTrackerWebhooks::dispatch($integration->id);
                    }

                    $counts['ok']++;
                } catch (ReconnectRequired) {
                    $counts['reconnect']++;
                } catch (IntegrationException) {
                    $counts['unreachable']++;
                }
            });

        $this->comment("Checked {$counts['checked']} integrations: {$counts['ok']} ok, {$counts['reconnect']} need reconnecting, {$counts['unreachable']} unreachable.");

        return self::SUCCESS;
    }
}
