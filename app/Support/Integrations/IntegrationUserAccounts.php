<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Jira\JiraClient;
use App\Support\Integrations\Linear\LinearClient;
use Illuminate\Support\Str;

/**
 * Accounts of the team's Jira site or Linear workspace. Provider emails
 * are compared here, in memory, and never stored or returned.
 */
class IntegrationUserAccounts
{
    private const SearchLimit = 20;

    private const JiraMatchLimit = 2;

    private const LinearPageSize = 250;

    private const LinearMaxPages = 40;

    private const JiraAccountType = 'atlassian';

    private const LinearUserFields = 'id name displayName email active';

    public function __construct(private JiraClient $jira, private LinearClient $linear) {}

    public function find(TeamIntegration $integration, string $accountId): ?ExternalAccount
    {
        try {
            return match ($integration->provider) {
                IntegrationProvider::Jira => $this->jiraAccount($this->jira->get($integration, 'rest/api/3/user', ['accountId' => $accountId])),
                IntegrationProvider::Linear => $this->linearAccount(data_get(
                    $this->linear->query($integration, 'query User($id: String!) { user(id: $id) { '.self::LinearUserFields.' } }', ['id' => $accountId]),
                    'user',
                )),
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
        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->matchLinearEmails($this->linearUsers($integration), $emails);
        }

        $matches = [];

        foreach ($emails as $email) {
            $account = $this->matchJiraEmail($integration, $email);

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
        if ($integration->provider === IntegrationProvider::Linear) {
            return $this->searchLinear($integration, Str::lower($query));
        }

        $results = $this->jira->get($integration, 'rest/api/3/user/search', ['query' => $query, 'maxResults' => self::SearchLimit]);

        return $this->activeJiraAccounts($results);
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
