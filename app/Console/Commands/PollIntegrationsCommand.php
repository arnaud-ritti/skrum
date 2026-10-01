<?php

namespace App\Console\Commands;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\TeamIntegration;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\IntegrationPolls;
use Illuminate\Console\Command;

class PollIntegrationsCommand extends Command
{
    protected $signature = 'skrum:poll-integrations';

    protected $description = 'Queue a read of every synced tracker integration that is due';

    public function handle(InboundModes $inboundModes): int
    {
        $trackers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker()),
        );
        $queued = 0;

        TeamIntegration::query()
            ->where('status', IntegrationStatus::Active->value)
            ->whereIn('provider', $trackers)
            ->where('settings->statusSync', true)
            ->lazyById()
            ->each(function (TeamIntegration $integration) use ($inboundModes, &$queued): void {
                $inboundModes->refresh($integration);

                if (! IntegrationPolls::isDue($integration)) {
                    return;
                }

                $this->info("Queueing a read of {$integration->provider->label()} integration `{$integration->id}`…");
                ReadTrackedIssues::dispatch($integration->id);
                $queued++;
            });

        $this->comment("Queued {$queued} integration reads.");

        return self::SUCCESS;
    }
}
