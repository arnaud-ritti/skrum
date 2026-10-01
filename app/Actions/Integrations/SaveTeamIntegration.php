<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Integrations\IntegrationActivated;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Creates or replaces a team's connection to a provider. Account mappings
 * are site-specific, so moving to another Jira site or Linear organization
 * deletes them. On the same site the webhook URL token and signing secret
 * survive a reconnect, so registered webhooks keep delivering; on another
 * site status sync stops and the old site's webhooks are removed.
 */
class SaveTeamIntegration
{
    private const WebhookCredentials = ['webhookToken', 'webhookSecret'];

    public function __construct(private TrackerWebhooks $trackerWebhooks) {}

    /**
     * @param  array{
     *     status: IntegrationStatus,
     *     access: IntegrationAccess,
     *     credentials: array<string, mixed>,
     *     settings: array<string, mixed>,
     *     scopes: array<int, string>
     * }  $attributes
     */
    public function handle(Team $team, IntegrationProvider $provider, User $user, array $attributes): TeamIntegration
    {
        $this->removeWebhooksOfPreviousSite($team, $provider, $attributes['settings']);

        return DB::transaction(function () use ($team, $provider, $user, $attributes): TeamIntegration {
            $existing = TeamIntegration::query()
                ->where('team_id', $team->id)
                ->where('provider', $provider->value)
                ->lockForUpdate()
                ->first();

            $wasActiveWriter = $existing !== null && $existing->canWrite();
            $previousSite = $existing?->site();
            $site = self::siteOf($provider, $attributes['settings']);
            $siteChanged = $previousSite !== null && $site !== null && $site !== $previousSite;
            $credentials = $provider->isTracker()
                ? [...Arr::except($attributes['credentials'], self::WebhookCredentials), ...self::keptWebhookCredentials($existing, $siteChanged)]
                : $attributes['credentials'];

            $integration = $existing ?? new TeamIntegration;

            $integration->forceFill([
                'team_id' => $team->id,
                'provider' => $provider,
                ...$attributes,
                'credentials' => $credentials,
                'connected_by_user_id' => $user->id,
                'last_error' => null,
                'last_checked_at' => now(),
            ]);

            if ($siteChanged) {
                $integration->forceFill([
                    'inbound_mode' => IntegrationInboundMode::Off,
                    'webhook_status' => null,
                    'webhook_expires_at' => null,
                ]);
            }

            $integration->save();

            if ($siteChanged) {
                $integration->userMappings()->delete();
            }

            if ($provider->isTracker() && $integration->canWrite() && ($siteChanged || ! $wasActiveWriter)) {
                IntegrationActivated::dispatch($integration, $siteChanged);
            }

            return $integration;
        });
    }

    /**
     * A tracker's inbound webhook URL token and signing secret belong to
     * its site, never to the credentials a reconnect brings.
     *
     * @return array<string, mixed>
     */
    private static function keptWebhookCredentials(?TeamIntegration $existing, bool $siteChanged): array
    {
        if ($existing === null || $siteChanged) {
            return [];
        }

        return Arr::only((array) $existing->readableCredentials(), self::WebhookCredentials);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private static function siteOf(IntegrationProvider $provider, array $settings): ?string
    {
        return (new TeamIntegration)->forceFill(['provider' => $provider, 'settings' => $settings])->site();
    }

    /**
     * Best effort, before the row is locked: the webhooks can only be
     * reached through the previous site's connection.
     *
     * @param  array<string, mixed>  $settings
     */
    private function removeWebhooksOfPreviousSite(Team $team, IntegrationProvider $provider, array $settings): void
    {
        $existing = $team->integration($provider);
        $site = self::siteOf($provider, $settings);

        if ($existing === null || ! $existing->isActive() || $existing->site() === null || $site === null || $site === $existing->site()) {
            return;
        }

        $webhookIds = TrackerWebhooks::ids($existing);

        if ($webhookIds !== []) {
            $this->trackerWebhooks->removeQuietly($existing, $webhookIds);
        }
    }
}
