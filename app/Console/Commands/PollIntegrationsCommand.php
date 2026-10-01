<?php

namespace App\Console\Commands;

use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Jobs\Integrations\ReadTrackedIssues;
use App\Models\TeamIntegration;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\IntegrationPolls;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Queue\Events\UniqueJobSkipped;
use Illuminate\Support\Facades\Event;

#[Description('Queue a read of every synced tracker integration that is due')]
#[Signature('skrum:poll-integrations')]
class PollIntegrationsCommand extends Command
{
    public function handle(InboundModes $inboundModes, TrackerWebhooks $trackerWebhooks): int
    {
        $trackers = array_map(
            fn (IntegrationProvider $provider): string => $provider->value,
            array_filter(IntegrationProvider::enabled(), fn (IntegrationProvider $provider): bool => $provider->isTracker()),
        );
        $queued = 0;
        $skipped = 0;

        Event::listen(UniqueJobSkipped::class, function (UniqueJobSkipped $event) use (&$skipped): void {
            if ($event->job instanceof ReadTrackedIssues) {
                $skipped++;
            }
        });

        try {
            TeamIntegration::query()
                ->where('status', IntegrationStatus::Active->value)
                ->whereIn('provider', $trackers)
                ->where('settings->statusSync', true)
                ->lazyById()
                ->each(function (TeamIntegration $integration) use ($inboundModes, $trackerWebhooks, &$queued, &$skipped): void {
                    $previousMode = $integration->inbound_mode;
                    $inboundModes->refresh($integration);

                    if ($previousMode !== IntegrationInboundMode::Webhook && $integration->inbound_mode === IntegrationInboundMode::Webhook) {
                        $trackerWebhooks->registerIfNeeded($integration);
                    }

                    $initialReadPending = StatusSync::initialReadPending($integration);

                    $isWaiting = $initialReadPending
                        ? IntegrationPolls::isPaused($integration->id)
                        : ! IntegrationPolls::isDue($integration);

                    if ($isWaiting) {
                        return;
                    }

                    $this->info("Queueing a read of {$integration->provider->label()} integration `{$integration->id}`…");
                    $skippedBefore = $skipped;
                    dispatch(new ReadTrackedIssues($integration->id, $initialReadPending, $initialReadPending));

                    if ($skipped === $skippedBefore) {
                        $queued++;
                    }
                });
        } finally {
            Event::forget(UniqueJobSkipped::class);
        }

        $this->comment("Queued {$queued} integration reads.");

        return self::SUCCESS;
    }
}
