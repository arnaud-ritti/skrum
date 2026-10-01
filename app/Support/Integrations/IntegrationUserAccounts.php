<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\SsoProvider;
use App\Models\SocialAccount;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\GitHub\GitHubClient;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

/**
 * Accounts of the team's Jira site, Jira server, Linear workspace or GitHub
 * installation. Provider emails are compared here, in memory, and never
 * stored or returned; GitHub is matched through SSO links only.
 */
class IntegrationUserAccounts
{
    private const SearchLimit = 20;

    private const JiraMatchLimit = 2;

    private const LinearPageSize = 250;

    private const LinearMaxPages = 40;

    private const JiraAccountType = 'atlassian';

    private const LinearUserFields = 'id name displayName email active';

    public function __construct(
        private JiraClient $jira,
        private LinearClient $linear,
        private JiraDataCenterClient $jiraDataCenter,
        private GitHubClient $gitHub,
    ) {}

    public function find(TeamIntegration $integration, string $accountId): ?ExternalAccount
    {
        try {
            return match ($integration->provider) {
                IntegrationProvider::Jira => $this->jiraAccount($this->jira->get($integration, 'rest/api/3/user', ['accountId' => $accountId])),
                IntegrationProvider::JiraDataCenter => $this->jiraDataCenterAccount($this->jiraDataCenter->get($integration, 'rest/api/2/user', ['username' => $accountId])),
                IntegrationProvider::Linear => $this->linearAccount(data_get(
                    $this->linear->query($integration, 'query User($id: String!) { user(id: $id) { '.self::LinearUserFields.' } }', ['id' => $accountId]),
                    'user',
                )),
                IntegrationProvider::GitHub => preg_match('/^\d{1,20}\z/', $accountId) === 1
                    ? $this->gitHubAccount($this->gitHub->get($integration, "user/{$accountId}"))
                    : null,
                default => null,
            };
        } catch (ProviderRejected) {
            return null;
        }
    }

    /**
     * @param  array<int, string>  $emails
     * @return array<string, ExternalAccount>
     */
    public function matchEmails(TeamIntegration $integration, array $emails): array
    {
        if ($integration->provider === IntegrationProvider::GitHub) {
            return [];
        }

        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->matchLinearEmails($this->linearUsers($integration), $emails);
        }

        $matches = [];

        foreach ($emails as $email) {
            $account = $integration->provider === IntegrationProvider::JiraDataCenter
                ? $this->matchJiraDataCenterEmail($integration, $email)
                : $this->matchJiraEmail($integration, $email);

            if ($account !== null) {
                $matches[Str::lower($email)] = $account;
            }
        }

        return $matches;
    }

    /**
     * @param  array<int, ExternalAccount>  $directory
     * @param  array<int, string>  $emails
     * @return array<string, ExternalAccount>
     */
    public function matchLinearEmails(array $directory, array $emails): array
    {
        $matches = [];

        foreach ($emails as $email) {
            $wanted = Str::lower($email);
            $candidates = array_values(array_filter(
                $directory,
                fn (ExternalAccount $account): bool => $account->active && $account->email() !== null && Str::lower($account->email()) === $wanted,
            ));

            if (count($candidates) === 1) {
                $matches[$wanted] = $candidates[0];
            }
        }

        return $matches;
    }

    /**
     * @return array<int, ExternalAccount>
     */
    public function linearUsers(TeamIntegration $integration): array
    {
        return array_values(array_filter(array_map(
            fn (array $node): ?ExternalAccount => $this->linearAccount($node),
            $this->linearNodes($integration),
        )));
    }

    /**
     * @return array<int, ExternalAccount>
     */
    public function search(TeamIntegration $integration, string $query): array
    {
        if ($integration->provider === IntegrationProvider::GitHub) {
            return $this->searchGitHub($integration, Str::lower($query));
        }

        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->searchLinear($integration, Str::lower($query));
        }

        if ($integration->provider === IntegrationProvider::JiraDataCenter) {
            return $this->activeJiraDataCenterAccounts($this->jiraDataCenter->get($integration, 'rest/api/2/user/search', ['username' => $query, 'maxResults' => self::SearchLimit]));
        }

        $results = $this->jira->get($integration, 'rest/api/3/user/search', ['query' => $query, 'maxResults' => self::SearchLimit]);

        return $this->activeJiraAccounts($results);
    }

    /**
     * Spec 8 §4.2: members who signed in to skrum with GitHub, keyed by
     * user id. No email is ever sent to GitHub.
     *
     * @param  iterable<int, User>  $members
     * @return array<string, ExternalAccount>
     */
    public function matchSso(TeamIntegration $integration, iterable $members): array
    {
        $ids = collect($members)->map(fn (User $member): string => $member->id)->all();
        $linked = SocialAccount::query()
            ->where('provider', SsoProvider::GitHub->value)
            ->whereIn('user_id', $ids)
            ->pluck('provider_user_id', 'user_id');
        $matches = [];

        foreach ($linked as $userId => $gitHubUserId) {
            $account = $this->find($integration, (string) $gitHubUserId);

            if ($account !== null && $account->active) {
                $matches[(string) $userId] = $account;
            }
        }

        return $matches;
    }

    /**
     * Organization members, or the export repository's collaborators for an
     * installation on a personal account; filtered here by login.
     *
     * @return array<int, ExternalAccount>
     */
    private function searchGitHub(TeamIntegration $integration, string $needle): array
    {
        $login = $integration->setting('accountLogin');
        $repositoryId = $integration->setting('exportRepositoryId');

        $users = match (true) {
            $integration->setting('accountType') === 'Organization' && GitHubClient::isLogin($login) => $this->gitHub->get($integration, "orgs/{$login}/members", ['per_page' => 100]),
            is_string($repositoryId) => $this->gitHub->get($integration, 'repos/'.$this->gitHub->repositoryName($integration, $repositoryId).'/collaborators', ['per_page' => 100]),
            default => [],
        };

        $found = array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->gitHubAccount($user), $users),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active && str_contains(Str::lower($account->displayName), $needle),
        ));

        return array_slice($found, 0, self::SearchLimit);
    }

    /**
     * The display name is the login; bots are never assignable.
     */
    private function gitHubAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_int($user['id'] ?? null) || ! GitHubClient::isLogin($user['login'] ?? null)) {
            return null;
        }

        return new ExternalAccount((string) $user['id'], $user['login'], ($user['type'] ?? 'User') === 'User');
    }

    /**
     * Name, display name or email contain the query.
     *
     * @return array<int, ExternalAccount>
     */
    private function searchLinear(TeamIntegration $integration, string $needle): array
    {
        $found = [];

        foreach ($this->linearNodes($integration) as $node) {
            $account = $this->linearAccount($node);

            if ($account === null || ! $account->active) {
                continue;
            }

            $haystack = Str::lower(implode(' ', [$account->displayName, (string) ($node['displayName'] ?? ''), (string) $account->email()]));

            if (! str_contains($haystack, $needle)) {
                continue;
            }

            $found[] = $account;

            if (count($found) === self::SearchLimit) {
                break;
            }
        }

        return $found;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function linearNodes(TeamIntegration $integration): array
    {
        $nodes = [];
        $after = null;
        $pages = 0;

        do {
            $page = data_get($this->linear->query(
                $integration,
                'query Users($first: Int!, $after: String) { users(first: $first, after: $after, includeDisabled: true) { nodes { '.self::LinearUserFields.' } pageInfo { hasNextPage endCursor } } }',
                ['first' => self::LinearPageSize, 'after' => $after],
            ), 'users');

            foreach ((array) data_get($page, 'nodes', []) as $node) {
                if (is_array($node)) {
                    $nodes[] = $node;
                }
            }

            $previous = $after;
            $after = data_get($page, 'pageInfo.endCursor');
            $pages++;
        } while (data_get($page, 'pageInfo.hasNextPage') === true && is_string($after) && $after !== $previous && $pages < self::LinearMaxPages);

        return $nodes;
    }

    private function matchJiraEmail(TeamIntegration $integration, string $email): ?ExternalAccount
    {
        $results = $this->jira->get($integration, 'rest/api/3/user/search', ['query' => $email, 'maxResults' => self::JiraMatchLimit]);
        $candidates = $this->activeJiraAccounts($results);

        if (count($candidates) !== 1) {
            return null;
        }

        $candidate = $candidates[0];

        if ($candidate->email() !== null && Str::lower($candidate->email()) !== Str::lower($email)) {
            return null;
        }

        return $candidate;
    }

    /**
     * @param  array<array-key, mixed>  $users
     * @return array<int, ExternalAccount>
     */
    private function activeJiraAccounts(array $users): array
    {
        return array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->jiraAccount($user), $users),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active,
        ));
    }

    private function jiraAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_string($user['accountId'] ?? null)) {
            return null;
        }

        if (($user['accountType'] ?? null) !== self::JiraAccountType) {
            return null;
        }

        $email = $user['emailAddress'] ?? null;

        return new ExternalAccount(
            $user['accountId'],
            is_string($user['displayName'] ?? null) ? $user['displayName'] : $user['accountId'],
            ($user['active'] ?? false) === true,
            is_string($email) && $email !== '' ? $email : null,
        );
    }

    /**
     * Spec 8 §4.1: accepted when exactly one active result has the
     * member's email.
     */
    private function matchJiraDataCenterEmail(TeamIntegration $integration, string $email): ?ExternalAccount
    {
        $results = $this->jiraDataCenter->get($integration, 'rest/api/2/user/search', ['username' => $email, 'maxResults' => self::JiraMatchLimit]);
        $candidates = array_values(array_filter(
            $this->activeJiraDataCenterAccounts($results),
            fn (ExternalAccount $account): bool => $account->email() !== null && Str::lower($account->email()) === Str::lower($email),
        ));

        return count($candidates) === 1 ? $candidates[0] : null;
    }

    /**
     * @param  array<array-key, mixed>  $users
     * @return array<int, ExternalAccount>
     */
    private function activeJiraDataCenterAccounts(array $users): array
    {
        return array_values(array_filter(
            array_map(fn (mixed $user): ?ExternalAccount => $this->jiraDataCenterAccount($user), $users),
            fn (?ExternalAccount $account): bool => $account !== null && $account->active,
        ));
    }

    private function jiraDataCenterAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_string($user['name'] ?? null) || $user['name'] === '') {
            return null;
        }

        $email = $user['emailAddress'] ?? null;

        return new ExternalAccount(
            $user['name'],
            is_string($user['displayName'] ?? null) && $user['displayName'] !== '' ? $user['displayName'] : $user['name'],
            ($user['active'] ?? false) === true,
            is_string($email) && $email !== '' ? $email : null,
        );
    }

    private function linearAccount(mixed $user): ?ExternalAccount
    {
        if (! is_array($user) || ! is_string($user['id'] ?? null)) {
            return null;
        }

        $name = is_string($user['name'] ?? null) && $user['name'] !== '' ? $user['name'] : (string) ($user['displayName'] ?? $user['id']);
        $email = $user['email'] ?? null;

        return new ExternalAccount(
            $user['id'],
            $name,
            ($user['active'] ?? false) === true,
            is_string($email) && $email !== '' ? $email : null,
        );
    }
}
