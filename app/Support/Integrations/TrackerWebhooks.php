<?php

namespace App\Support\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationWebhookStatus;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Jobs\Integrations\RemoveTrackerWebhooks;
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

    /** A rejected registration is retried after a day, or once the tracked projects change. */
    public const RetryRejectedAfterHours = 24;

    private const LifetimeDays = 30;

    private const SecretLength = 40;

    private const WebhookIdPattern = '/^\d{1,20}\z/';

    public function __construct(
        private JiraApis $jiraApis,
        private TrackedIssues $trackedIssues,
        private InboundModes $inboundModes,
    ) {}

    /**
     * Keys are quoted: `OR`, `IN`, `IS` or `BY` are valid project keys but
     * JQL reserved words.
     *
     * @param  array<int, string>  $projectKeys  validated project keys
     */
    public static function jql(array $projectKeys): string
    {
        $quotedKeys = implode(', ', array_map(fn (string $key): string => "\"{$key}\"", $projectKeys));

        return "project in ({$quotedKeys})";
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

    /**
     * Whether the registered webhooks still cover the tracked projects and
     * still deliver: a Jira Cloud webhook past its expiry is gone, and a
     * failing one is replaced. A webhook registered by hand is left alone.
     */
    public function isCurrent(TeamIntegration $integration): bool
    {
        if ($this->isManuallyRegistered($integration)) {
            return true;
        }

        $projects = $this->trackedIssues->containerKeys($integration);

        if ((array) $integration->setting('webhookProjects', []) !== $projects) {
            return false;
        }

        if ($projects === []) {
            return true;
        }

        $expired = $integration->provider === IntegrationProvider::Jira
            && $integration->webhook_expires_at !== null
            && $integration->webhook_expires_at->isPast();

        return self::ids($integration) !== []
            && ! $expired
            && $integration->webhook_status !== IntegrationWebhookStatus::Failing;
    }

    /**
     * A Jira Data Center webhook an administrator registered by hand and
     * confirmed: skrum never registers a second one next to it.
     */
    public function isManuallyRegistered(TeamIntegration $integration): bool
    {
        return $integration->setting('webhookManual') === true && $integration->webhook_status !== null;
    }

    /**
     * Whether a recent rejection for the same projects says a new attempt
     * would fail again.
     */
    public function isBackedOff(TeamIntegration $integration): bool
    {
        $failedAt = IssueStatus::time($integration->setting('webhookFailedAt'));

        return $failedAt !== null
            && $failedAt->gt(now()->subHours(self::RetryRejectedAfterHours))
            && (array) $integration->setting('webhookFailedProjects', []) === $this->trackedIssues->containerKeys($integration);
    }

    public function recordRejection(TeamIntegration $integration): void
    {
        $integration->mergeSettings([
            'webhookFailedAt' => now()->toIso8601String(),
            'webhookFailedProjects' => $this->trackedIssues->containerKeys($integration),
        ]);
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
        $previousIds = self::ids($integration);

        if ($projects === []) {
            $this->saveRegistration($integration, [], []);
            $this->removeOrRetryLater($integration, $previousIds);

            return;
        }

        $ids = $integration->provider === IntegrationProvider::Jira
            ? $this->registerCloud($integration, $projects)
            : $this->registerDataCenter($integration, $projects);

        if ($ids === null) {
            $this->recordRejection($integration);
            $integration->mergeSettings(['webhookManual' => true, 'webhookIds' => [], 'webhookProjects' => []]);
            $this->inboundModes->refresh($integration);
            $this->removeOrRetryLater($integration, $previousIds);

            return;
        }

        $this->saveRegistration($integration, $ids, $projects);
        $this->removeOrRetryLater($integration, $previousIds);
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
            'webhook_status' => $integration->webhook_status === IntegrationWebhookStatus::Failing ? IntegrationWebhookStatus::Pending : $integration->webhook_status,
        ])->save();
    }

    /**
     * A webhook already gone (404) counts as removed; any other failure is
     * thrown after the remaining ids were tried.
     *
     * @param  array<int, string>  $ids
     */
    public function remove(TeamIntegration $integration, array $ids): void
    {
        $ids = array_values(array_filter($ids, fn (string $id): bool => preg_match(self::WebhookIdPattern, $id) === 1));

        if ($ids === []) {
            return;
        }

        $api = $this->jiraApis->for($integration);
        $requests = $integration->provider === IntegrationProvider::Jira
            ? [fn () => $api->delete($integration, $api->apiPath('webhook'), ['webhookIds' => array_map('intval', $ids)])]
            : array_map(fn (string $id) => fn () => $api->delete($integration, "rest/webhooks/1.0/webhook/{$id}"), $ids);
        $failure = null;

        foreach ($requests as $request) {
            try {
                $request();
            } catch (ProviderRejected $exception) {
                if ($exception->httpStatus !== 404) {
                    $failure = $exception;
                }
            } catch (ReconnectRequired $exception) {
                throw $exception;
            } catch (IntegrationException $exception) {
                $failure = $exception;
            }
        }

        if ($failure !== null) {
            throw $failure;
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

    /**
     * Queues a registration when the projects changed or the webhook
     * stopped delivering, unless the last attempt was rejected recently.
     */
    public function registerIfNeeded(TeamIntegration $integration): void
    {
        if (! $this->canRegister($integration) || $this->isCurrent($integration) || $this->isBackedOff($integration)) {
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
     * @param  array<int, string>  $ids
     */
    private function removeOrRetryLater(TeamIntegration $integration, array $ids): void
    {
        if ($ids === []) {
            return;
        }

        try {
            $this->remove($integration, $ids);
        } catch (IntegrationException) {
            RemoveTrackerWebhooks::dispatch($integration->id, $ids);
        }
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

        if (! $this->storeRegistrationWhileSynced($integration, [
            'webhookIds' => $ids,
            'webhookProjects' => $projects,
            'webhookManual' => false,
            'webhookRegisteredAt' => $registered ? now()->toIso8601String() : $integration->setting('webhookRegisteredAt'),
            'webhookFailedAt' => null,
            'webhookFailedProjects' => [],
        ])) {
            $this->removeOrRetryLater($integration, $ids);

            return;
        }

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
     * Sync may have been turned off while the provider registered the
     * webhooks; its removal then already ran without these ids.
     *
     * @param  array<string, mixed>  $changes
     */
    private function storeRegistrationWhileSynced(TeamIntegration $integration, array $changes): bool
    {
        return DB::transaction(function () use ($integration, $changes): bool {
            $locked = TeamIntegration::query()->whereKey($integration->id)->lockForUpdate()->firstOrFail();
            $isSynced = StatusSync::isOn($locked);

            if ($isSynced) {
                $locked->forceFill(['settings' => [...$locked->settings, ...$changes]])->save();
            }

            $integration->setRawAttributes($locked->getAttributes(), true);

            return $isSynced;
        });
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
