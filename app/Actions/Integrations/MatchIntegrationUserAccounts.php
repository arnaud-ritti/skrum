<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Enums\SsoProvider;
use App\Models\IntegrationUserMapping;
use App\Models\SocialAccount;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Spec §7.1 automatic matching: existing rows are only re-checked (stale
 * email and sign-in rows are deleted so they can match again, inactive
 * manual rows are flagged), then members without a row are matched by
 * verified email, or for GitHub by the GitHub account they sign in with.
 */
class MatchIntegrationUserAccounts
{
    public function __construct(private IntegrationUserAccounts $accounts) {}

    public function handle(TeamIntegration $integration): void
    {
        if (! IntegrationMappingGuard::canMap($integration)) {
            return;
        }

        $directory = $integration->provider === IntegrationProvider::Linear
            ? $this->accounts->linearUsers($integration)
            : null;

        $this->recheck($integration, $directory);
        $this->matchUnmapped($integration, $directory);
    }

    /**
     * @param  array<int, ExternalAccount>|null  $directory
     */
    private function recheck(TeamIntegration $integration, ?array $directory): void
    {
        $known = $directory === null ? null : collect($directory)->keyBy(fn (ExternalAccount $account): string => $account->id);

        $mappings = $integration->userMappings()->whereNotNull('external_account_id')->get();

        foreach ($mappings as $mapping) {
            $accountId = (string) $mapping->external_account_id;

            if ($mapping->matched_by === IntegrationUserMatch::Sso && ! $this->isSignInLinked($mapping->user_id, $accountId)) {
                $this->unchanged($integration, $mapping)->delete();

                continue;
            }
            $account = $known === null ? $this->accounts->find($integration, $accountId) : $known->get($accountId);
            $usable = $account !== null && $account->active;
            $unchanged = $this->unchanged($integration, $mapping);

            if (! $usable && in_array($mapping->matched_by, [IntegrationUserMatch::Email, IntegrationUserMatch::Sso], true)) {
                $unchanged->delete();

                continue;
            }

            $unchanged->update([
                'account_inactive' => ! $usable,
                'external_display_name' => $account === null ? $mapping->external_display_name : $account->displayName,
                'checked_at' => now(),
            ]);
        }
    }

    /**
     * A sign-in match lasts only while the member still signs in with that
     * GitHub account.
     */
    private function isSignInLinked(string $userId, string $accountId): bool
    {
        return SocialAccount::query()
            ->where('user_id', $userId)
            ->where('provider', SsoProvider::GitHub->value)
            ->where('provider_user_id', $accountId)
            ->exists();
    }

    /**
     * The provider lookups are slow, so an admin may have saved another
     * choice for this member meanwhile: writes only touch the row as loaded.
     *
     * @return HasMany<IntegrationUserMapping, TeamIntegration>
     */
    private function unchanged(TeamIntegration $integration, IntegrationUserMapping $mapping): HasMany
    {
        return $integration->userMappings()
            ->whereKey($mapping->getKey())
            ->where('matched_by', $mapping->matched_by)
            ->where('external_account_id', $mapping->external_account_id);
    }

    /**
     * @param  array<int, ExternalAccount>|null  $directory
     */
    private function matchUnmapped(TeamIntegration $integration, ?array $directory): void
    {
        $mapped = $integration->userMappings()->pluck('user_id')->all();

        if ($integration->provider === IntegrationProvider::GitHub) {
            $members = $integration->team->members()->whereNotIn('users.id', $mapped)->get();

            foreach ($this->accounts->matchSso($integration, $members) as $userId => $account) {
                $integration->userMappings()->firstOrCreate(['user_id' => $userId], [
                    'external_account_id' => $account->id,
                    'external_display_name' => $account->displayName,
                    'matched_by' => IntegrationUserMatch::Sso,
                    'account_inactive' => false,
                    'checked_at' => now(),
                ]);
            }

            return;
        }

        $members = $integration->team->members()
            ->whereNotNull('email_verified_at')
            ->whereNotIn('users.id', $mapped)
            ->get();

        if ($members->isEmpty()) {
            return;
        }

        $emails = $members->map(fn (User $member): string => $member->email)->all();

        $matches = $directory === null
            ? $this->accounts->matchEmails($integration, $emails)
            : $this->accounts->matchLinearEmails($directory, $emails);

        foreach ($members as $member) {
            $account = $matches[Str::lower($member->email)] ?? null;

            if ($account === null) {
                continue;
            }

            $integration->userMappings()->firstOrCreate(['user_id' => $member->id], [
                'external_account_id' => $account->id,
                'external_display_name' => $account->displayName,
                'matched_by' => IntegrationUserMatch::Email,
                'account_inactive' => false,
                'checked_at' => now(),
            ]);
        }
    }
}
