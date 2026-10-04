<?php

namespace App\Console\Commands;

use App\Actions\Integrations\CheckIntegration;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Models\TeamIntegration;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Description('Check that every active team integration still has access')]
#[Signature('skrum:check-integrations')]
class CheckIntegrationsCommand extends Command
{
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
                        dispatch(new ReadTrackedIssues($integration->id, true));
                    }

                    if (StatusSync::isOn($integration) && $trackerWebhooks->expiresSoon($integration)) {
                        dispatch(new RegisterTrackerWebhooks($integration->id));
                    }

                    $counts['ok']++;
                } catch (ReconnectRequired) {
                    $counts['reconnect']++;
                } catch (IntegrationException) {
                    $counts['unreachable']++;
                } catch (Throwable $exception) {
                    report($exception);
                    $counts['unreachable']++;
                }
            });

        $this->comment("Checked {$counts['checked']} integrations: {$counts['ok']} ok, {$counts['reconnect']} need reconnecting, {$counts['unreachable']} unreachable.");

        return self::SUCCESS;
    }
}
