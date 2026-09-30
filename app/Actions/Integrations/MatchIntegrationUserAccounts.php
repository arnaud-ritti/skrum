<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Spec §7.1 automatic matching: existing rows are only re-checked (stale
 * email rows are deleted so they can match again, inactive manual rows are
 * flagged), then members without a row are matched by verified email.
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
            $account = $known === null ? $this->accounts->find($integration, $accountId) : $known->get($accountId);
            $usable = $account !== null && $account->active;
            $unchanged = $this->unchanged($integration, $mapping);

            if (! $usable && $mapping->matched_by === IntegrationUserMatch::Email) {
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
