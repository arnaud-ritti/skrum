<?php

namespace App\Support\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Jira\JiraApis;
use App\Support\Integrations\Trackers\IssueStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Spec 8 §4.1, §5.3: Jira Cloud dynamic webhooks (30-day expiry, refreshed
 * within 7 days) and Jira Data Center webhooks (registered by skrum when
 * the account administers Jira, else by hand), filtered to the projects of
 * tracked issues. The URL token and the Data Center secret are generated
 * here and only ever leave through `manualDetails()`.
 */
class TrackerWebhooks
{
    public const Events = ['jira:issue_updated', 'jira:issue_deleted'];

    public const RefreshWithinDays = 7;

    private const LifetimeDays = 30;

    private const SecretLength = 40;

    private const WebhookIdPattern = '/^\d{1,20}\z/';

    public function __construct(
        private JiraApis $jiraApis,
        private TrackedIssues $trackedIssues,
        private InboundModes $inboundModes,
    ) {}

    /**
     * @param  array<int, string>  $projectKeys  validated project keys
     */
    public static function jql(array $projectKeys): string
    {
        return 'project in ('.implode(', ', $projectKeys).')';
    }

    /**
     * @return array<int, string>
     */
    public static function ids(TeamIntegration $integration): array
    {
        $ids = [];

        foreach ((array) $integration->setting('webhookIds', []) as $id) {
            if ((is_string($id) || is_int($id)) && preg_match(self::WebhookIdPattern, (string) $id) === 1) {
                $ids[] = (string) $id;
            }
        }

        return $ids;
    }

    public function url(TeamIntegration $integration): string
    {
        return route('integrations.webhooks.tracker.store', [
            'source' => $integration->provider === IntegrationProvider::JiraDataCenter ? 'jira-dc' : 'jira',
            'integration' => $integration->id,
            'token' => (string) $integration->credential('webhookToken'),
        ]);
    }

    /**
     * Whether skrum registers this connection's webhooks itself right now.
     */
    public function canRegister(TeamIntegration $integration): bool
    {
        if (! in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)) {
            return false;
        }

        if (! StatusSync::isOn($integration) || ! $integration->isActive() || ! $this->inboundModes->acceptsWebhooks($integration->provider)) {
            return false;
        }

        return $integration->provider !== IntegrationProvider::Jira || $integration->hasScope(InboundModes::JiraWebhookScope);
    }

    public function isCurrent(TeamIntegration $integration): bool
    {
        return self::ids($integration) !== []
            && (array) $integration->setting('webhookProjects', []) === $this->trackedIssues->containerKeys($integration);
    }

    public function expiresSoon(TeamIntegration $integration): bool
    {
        return $integration->provider === IntegrationProvider::Jira
            && $integration->webhook_expires_at !== null
            && $integration->webhook_expires_at->lte(now()->addDays(self::RefreshWithinDays));
    }

    public function register(TeamIntegration $integration): void
    {
        $integration = $this->ensureSecrets($integration);
        $projects = $this->trackedIssues->containerKeys($integration);

        $this->removeQuietly($integration, self::ids($integration));

        if ($projects === []) {
            $this->saveRegistration($integration, [], []);

            return;
        }

        $ids = $integration->provider === IntegrationProvider::Jira
            ? $this->registerCloud($integration, $projects)
            : $this->registerDataCenter($integration, $projects);

        if ($ids === null) {
            $integration->mergeSettings(['webhookManual' => true, 'webhookIds' => [], 'webhookProjects' => []]);
            $this->inboundModes->refresh($integration);

            return;
        }

        $this->saveRegistration($integration, $ids, $projects);
    }

    public function refresh(TeamIntegration $integration): void
    {
        $ids = self::ids($integration);

        if ($ids === []) {
            return;
        }

        $api = $this->jiraApis->for($integration);
        $response = $api->put($integration, $api->apiPath('webhook/refresh'), ['webhookIds' => array_map('intval', $ids)]);

        $integration->forceFill([
            'webhook_expires_at' => IssueStatus::time($response['expirationDate'] ?? null) ?? now()->addDays(self::LifetimeDays),
        ])->save();
    }

    /**
     * @param  array<int, string>  $ids
     */
    public function remove(TeamIntegration $integration, array $ids): void
    {
        $ids = array_values(array_filter($ids, fn (string $id): bool => preg_match(self::WebhookIdPattern, $id) === 1));

        if ($ids === []) {
            return;
        }

        $api = $this->jiraApis->for($integration);

        if ($integration->provider === IntegrationProvider::Jira) {
            $api->delete($integration, $api->apiPath('webhook'), ['webhookIds' => array_map('intval', $ids)]);

            return;
        }

        foreach ($ids as $id) {
            $api->delete($integration, "rest/webhooks/1.0/webhook/{$id}");
        }
    }

    /**
     * @param  array<int, string>  $ids
     */
    public function removeQuietly(TeamIntegration $integration, array $ids): void
    {
        try {
            $this->remove($integration, $ids);
        } catch (IntegrationException) {
            // Best effort: a leftover webhook only delivers events skrum ignores.
        }
    }

    public function registerIfProjectsChanged(TeamIntegration $integration): void
    {
        if (! $this->canRegister($integration) || $integration->setting('webhookManual') === true) {
            return;
        }

        if ((array) $integration->setting('webhookProjects', []) === $this->trackedIssues->containerKeys($integration)) {
            return;
        }

        RegisterTrackerWebhooks::dispatch($integration->id);
    }

    /**
     * @return array{url: string, secret: string, events: array<int, string>, jql: ?string}
     */
    public function manualDetails(TeamIntegration $integration): array
    {
        $integration = $this->ensureSecrets($integration);
        $projects = $this->trackedIssues->containerKeys($integration);

        return [
            'url' => $this->url($integration),
            'secret' => (string) $integration->credential('webhookSecret'),
            'events' => self::Events,
            'jql' => $projects === [] ? null : self::jql($projects),
        ];
    }

    public function confirmManual(TeamIntegration $integration): TeamIntegration
    {
        $integration = $this->ensureSecrets($integration);
        $integration->mergeSettings(['webhookManual' => true, 'webhookRegisteredAt' => now()->toIso8601String()]);
        $integration->forceFill([
            'webhook_status' => $integration->webhook_status === IntegrationWebhookStatus::Active
                ? IntegrationWebhookStatus::Active
                : IntegrationWebhookStatus::Pending,
        ])->save();

        return $this->inboundModes->refresh($integration);
    }

    /**
     * @param  array<int, string>  $projects
     * @return array<int, string>
     */
    private function registerCloud(TeamIntegration $integration, array $projects): array
    {
        $api = $this->jiraApis->for($integration);
        $response = $api->post($integration, $api->apiPath('webhook'), [
            'url' => $this->url($integration),
            'webhooks' => [['events' => self::Events, 'jqlFilter' => self::jql($projects)]],
        ]);
        $ids = [];

        foreach ((array) ($response['webhookRegistrationResult'] ?? []) as $result) {
            $id = data_get($result, 'createdWebhookId');

            if (is_int($id) || (is_string($id) && ctype_digit($id))) {
                $ids[] = (string) $id;
            }
        }

        if ($ids === []) {
            $error = data_get($response, 'webhookRegistrationResult.0.errors.0');

            throw new ProviderRejected(IntegrationProvider::Jira, is_string($error) ? $error : 'webhook_not_registered');
        }

        return $ids;
    }

    /**
     * @param  array<int, string>  $projects
     * @return array<int, string>|null null when the account does not administer Jira
     */
    private function registerDataCenter(TeamIntegration $integration, array $projects): ?array
    {
        $api = $this->jiraApis->for($integration);
        $permissions = $api->get($integration, $api->apiPath('mypermissions'), ['permissions' => 'ADMINISTER']);

        if (data_get($permissions, 'permissions.ADMINISTER.havePermission') !== true) {
            return null;
        }

        $response = $api->post($integration, 'rest/webhooks/1.0/webhook', [
            'name' => Str::limit("skrum · {$integration->team->name}", 100, ''),
            'url' => $this->url($integration),
            'events' => self::Events,
            'filters' => ['issue-related-events-section' => self::jql($projects)],
            'excludeBody' => false,
        ]);
        $self = $response['self'] ?? null;
        $id = is_string($self) ? basename($self) : '';

        if (preg_match(self::WebhookIdPattern, $id) !== 1) {
            throw new ProviderRejected(IntegrationProvider::JiraDataCenter, 'webhook_not_registered');
        }

        return [$id];
    }

    /**
     * @param  array<int, string>  $ids
     * @param  array<int, string>  $projects
     */
    private function saveRegistration(TeamIntegration $integration, array $ids, array $projects): void
    {
        $registered = $ids !== [];

        $integration->mergeSettings([
            'webhookIds' => $ids,
            'webhookProjects' => $projects,
            'webhookManual' => false,
            'webhookRegisteredAt' => $registered ? now()->toIso8601String() : $integration->setting('webhookRegisteredAt'),
        ]);

        $integration->forceFill([
            'webhook_status' => match (true) {
                ! $registered => $integration->webhook_status,
                $integration->webhook_status === IntegrationWebhookStatus::Active => IntegrationWebhookStatus::Active,
                default => IntegrationWebhookStatus::Pending,
            },
            'webhook_expires_at' => $registered && $integration->provider === IntegrationProvider::Jira ? now()->addDays(self::LifetimeDays) : null,
        ])->save();

        $this->inboundModes->refresh($integration);
    }

    /**
     * The URL token (and the Data Center signing secret) exist before any
     * registration; generated once, kept across re-registrations. Written
     * under the row lock so a concurrent token refresh is never lost.
     */
    private function ensureSecrets(TeamIntegration $integration): TeamIntegration
    {
        if ($integration->readableCredentials() === null) {
            throw new ReconnectRequired($integration->provider, $integration->last_error);
        }

        $keys = $integration->provider === IntegrationProvider::JiraDataCenter ? ['webhookToken', 'webhookSecret'] : ['webhookToken'];

        return DB::transaction(function () use ($integration, $keys): TeamIntegration {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $credentials = (array) $locked->readableCredentials();
            $changed = false;

            foreach ($keys as $key) {
                if (! is_string($credentials[$key] ?? null) || $credentials[$key] === '') {
                    $credentials[$key] = Str::random(self::SecretLength);
                    $changed = true;
                }
            }

            if ($changed) {
                $locked->forceFill(['credentials' => $credentials])->save();
            }

            $integration->setRawAttributes($locked->getAttributes(), true);

            return $integration;
        });
    }
}
