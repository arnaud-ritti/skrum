<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Exceptions\Integrations\ConnectionRefused;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use SensitiveParameter;

/**
 * Spec 8 §4.1 fallback: a token pasted by an Owner/Admin acts as the person
 * who created it. It is stored encrypted in the credentials and never shown
 * again; `read` access makes skrum refuse every write itself.
 */
class ConnectJiraDataCenterToken
{
    private const string MinimumVersion = '8.14';

    public function __construct(
        private JiraDataCenterClient $client,
        private SaveTeamIntegration $saveTeamIntegration,
        private DetectJiraStoryPointFields $detectStoryPointFields,
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'token' => ['required', 'string', 'min:20', 'max:255'],
            'access' => ['required', Rule::enum(IntegrationAccess::class)],
            'acknowledged' => ['required', 'accepted'],
        ];
    }

    public function handle(Team $team, User $user, #[SensitiveParameter] string $token, IntegrationAccess $access): TeamIntegration
    {
        try {
            $owner = $this->client->probe($token, 'rest/api/2/myself');
            $serverInfo = $this->client->probe($token, 'rest/api/2/serverInfo');
        } catch (ConnectionRefused $exception) {
            throw ValidationException::withMessages(['token' => $exception->getMessage()]);
        }

        $unsupported = $this->unsupportedReason($serverInfo);

        if ($unsupported !== null) {
            throw ValidationException::withMessages(['token' => $unsupported]);
        }

        $current = $team->integration(IntegrationProvider::JiraDataCenter)->settings ?? [];

        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::JiraDataCenter, $user, [
            'status' => IntegrationStatus::Active,
            'access' => $access,
            'credentials' => ['personalAccessToken' => $token],
            'settings' => [
                ...ConnectJiraDataCenter::keptSettings($current),
                ...ConnectJiraDataCenter::serverSettings($serverInfo),
                'authMethod' => JiraDataCenterClient::AuthMethodToken,
                'tokenOwner' => $this->owner($owner),
                'tokenSavedAt' => now()->toIso8601String(),
            ],
            'scopes' => [],
        ]);

        $this->detectStoryPointFields->handleQuietly($integration);

        return $integration;
    }

    /**
     * @param  array<array-key, mixed>  $serverInfo
     */
    private function unsupportedReason(array $serverInfo): ?string
    {
        $numbers = array_values(array_filter((array) ($serverInfo['versionNumbers'] ?? []), is_int(...)));

        if (count($numbers) < 2) {
            return __("We couldn't read the Jira version.");
        }

        if (version_compare("{$numbers[0]}.{$numbers[1]}", self::MinimumVersion, '<')) {
            return __('Personal access tokens need Jira 8.14 or later.');
        }

        return null;
    }

    /**
     * @param  array<array-key, mixed>  $myself
     * @return array{name: string, displayName: string}
     */
    private function owner(array $myself): array
    {
        $name = is_string($myself['name'] ?? null) ? mb_substr($myself['name'], 0, 255) : '';
        $displayName = is_string($myself['displayName'] ?? null) && trim($myself['displayName']) !== ''
            ? mb_substr(trim($myself['displayName']), 0, 255)
            : $name;

        return ['name' => $name, 'displayName' => $displayName];
    }
}
