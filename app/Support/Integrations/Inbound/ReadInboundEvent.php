<?php

namespace App\Support\Integrations\Inbound;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\InboundSignatureInvalid;
use App\Models\TeamIntegration;
use Illuminate\Http\Request;

/**
 * Verifies a provider delivery and extracts its key, type, target
 * connections and issue ids (spec 8 §5.3). Payloads are hints: nothing
 * else is read from them, and they are never kept.
 */
class ReadInboundEvent
{
    private const int KeyLength = 191;

    private const int TypeLength = 100;

    private const int TimestampToleranceMs = 60_000;

    public static function provider(string $source): IntegrationProvider
    {
        return match ($source) {
            'jira' => IntegrationProvider::Jira,
            'jira-dc' => IntegrationProvider::JiraDataCenter,
            'linear' => IntegrationProvider::Linear,
            'github' => IntegrationProvider::GitHub,
            default => abort(404),
        };
    }

    /**
     * @throws InboundSignatureInvalid
     */
    public function handle(IntegrationProvider $provider, Request $request, ?string $integrationId, ?string $token): InboundEvent
    {
        return match ($provider) {
            IntegrationProvider::Jira => $this->jira($request, $integrationId, $token),
            IntegrationProvider::JiraDataCenter => $this->jiraDataCenter($request, $integrationId, $token),
            IntegrationProvider::Linear => $this->linear($request),
            IntegrationProvider::GitHub => $this->gitHub($request),
            default => abort(404),
        };
    }

    private function jira(Request $request, ?string $integrationId, ?string $token): InboundEvent
    {
        $integration = $this->integrationWithToken(IntegrationProvider::Jira, $integrationId, $token);
        $jwt = $request->bearerToken();

        throw_if($jwt !== null && ! JiraWebhookJwt::isValid($jwt, (string) config('services.jira.client_secret')), InboundSignatureInvalid::class, $integration);

        return $this->jiraEvent(IntegrationProvider::Jira, $request, $integration);
    }

    private function jiraDataCenter(Request $request, ?string $integrationId, ?string $token): InboundEvent
    {
        $integration = $this->integrationWithToken(IntegrationProvider::JiraDataCenter, $integrationId, $token);
        $signature = (string) $request->header('X-Hub-Signature', '');

        if ($signature !== '') {
            $secret = $integration->credential('webhookSecret');

            throw_if(! is_string($secret) || $secret === '' || ! hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret), $signature), InboundSignatureInvalid::class, $integration);
        }

        return $this->jiraEvent(IntegrationProvider::JiraDataCenter, $request, $integration);
    }

    private function linear(Request $request): InboundEvent
    {
        $secret = (string) config('services.linear.webhook_secret');
        $signature = (string) $request->header('Linear-Signature', '');

        throw_if($secret === '' || $signature === '' || ! hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $signature), InboundSignatureInvalid::class);

        $payload = $this->payload($request);
        $sentAt = $payload['webhookTimestamp'] ?? null;

        throw_if(! is_int($sentAt) || abs(now()->getTimestampMs() - $sentAt) > self::TimestampToleranceMs, InboundSignatureInvalid::class);

        $organizationId = $payload['organizationId'] ?? null;
        $issueId = ($payload['type'] ?? null) === 'Issue' ? data_get($payload, 'data.id') : null;
        $type = implode('.', array_filter([$payload['type'] ?? null, $payload['action'] ?? null], is_string(...)));

        return new InboundEvent(
            provider: IntegrationProvider::Linear,
            key: $this->key($request, 'Linear-Delivery'),
            type: $this->type($type),
            integrations: is_string($organizationId)
                ? TeamIntegration::query()->where('provider', IntegrationProvider::Linear->value)->where('settings->organizationId', $organizationId)->get()
                : collect(),
            externalIds: is_string($issueId) && $issueId !== '' ? [$issueId] : [],
        );
    }

    private function gitHub(Request $request): InboundEvent
    {
        $secret = (string) config('services.github_app.webhook_secret');
        $signature = (string) $request->header('X-Hub-Signature-256', '');

        throw_if($secret === '' || ! hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret), $signature), InboundSignatureInvalid::class);

        $payload = $this->payload($request);
        $event = (string) $request->header('X-GitHub-Event', '');
        $action = is_string($payload['action'] ?? null) ? $payload['action'] : '';
        $installationId = data_get($payload, 'installation.id');
        $number = data_get($payload, 'issue.number');
        $repositoryId = data_get($payload, 'repository.id');

        return new InboundEvent(
            provider: IntegrationProvider::GitHub,
            key: str_starts_with($event, 'installation')
                ? 'installation:'.hash('sha256', $request->getContent())
                : $this->key($request, 'X-GitHub-Delivery'),
            type: $this->type("{$event}.{$action}"),
            integrations: is_int($installationId)
                ? TeamIntegration::query()->where('provider', IntegrationProvider::GitHub->value)->where('settings->installationId', (string) $installationId)->get()
                : collect(),
            externalIds: $event === 'issues' && is_int($number) && is_int($repositoryId) ? ["{$repositoryId}/{$number}"] : [],
            removedRepositoryIds: $event === 'installation_repositories' && $action === 'removed'
                ? $this->repositoryIds($payload['repositories_removed'] ?? [])
                : [],
            installationRemoved: $event === 'installation' && in_array($action, ['deleted', 'suspend'], true) ? $action : null,
            installationId: is_int($installationId) ? (string) $installationId : null,
        );
    }

    private function integrationWithToken(IntegrationProvider $provider, ?string $integrationId, ?string $token): TeamIntegration
    {
        $integration = $integrationId === null
            ? null
            : TeamIntegration::query()->where('provider', $provider->value)->find($integrationId);
        $expected = $integration?->readableCredentials()['webhookToken'] ?? null;

        throw_if($integration === null || ! is_string($expected) || $expected === '' || ! is_string($token) || ! hash_equals($expected, $token), InboundSignatureInvalid::class, $integration);

        return $integration;
    }

    private function jiraEvent(IntegrationProvider $provider, Request $request, TeamIntegration $integration): InboundEvent
    {
        $payload = $this->payload($request);
        $issueId = data_get($payload, 'issue.id');
        $issueId = is_int($issueId) ? (string) $issueId : $issueId;

        return new InboundEvent(
            provider: $provider,
            key: $this->key($request, 'X-Atlassian-Webhook-Identifier', $integration->id),
            type: $this->type($payload['webhookEvent'] ?? null),
            integrations: collect([$integration]),
            externalIds: is_string($issueId) && ctype_digit($issueId) ? [$issueId] : [],
        );
    }

    /**
     * @return array<int, string>
     */
    private function repositoryIds(mixed $repositories): array
    {
        $ids = [];

        foreach ((array) $repositories as $repository) {
            $id = data_get($repository, 'id');

            if (is_int($id)) {
                $ids[] = (string) $id;
            }
        }

        return $ids;
    }

    /**
     * The delivery id, else a hash of the body. Per-connection URLs scope
     * the key to their connection, so one team's deliveries can neither
     * collide with nor pre-empt another's.
     */
    private function key(Request $request, string $header, ?string $scope = null): string
    {
        $delivery = trim((string) $request->header($header, ''));
        $key = $delivery !== '' ? $delivery : hash('sha256', $request->getContent());

        return mb_substr($scope === null ? $key : "{$scope}:{$key}", 0, self::KeyLength);
    }

    private function type(mixed $type): string
    {
        return is_string($type) && $type !== '' ? mb_substr($type, 0, self::TypeLength) : 'unknown';
    }

    /**
     * @return array<array-key, mixed>
     */
    private function payload(Request $request): array
    {
        $decoded = json_decode($request->getContent(), true);

        return is_array($decoded) ? $decoded : [];
    }
}
