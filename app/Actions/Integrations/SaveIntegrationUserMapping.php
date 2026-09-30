<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationUserMatch;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Validation\ValidationException;

class SaveIntegrationUserMapping
{
    public function __construct(private IntegrationUserAccounts $accounts) {}

    /**
     * A null account id is "Never assign", which automatic matching never
     * overwrites.
     */
    public function handle(TeamIntegration $integration, User $member, ?string $accountId): IntegrationUserMapping
    {
        $account = null;

        if ($accountId !== null) {
            $account = $this->accounts->find($integration, $accountId);

            if ($account === null || ! $account->active) {
                throw ValidationException::withMessages([
                    'external_account_id' => __('This :provider account was not found or is inactive.', ['provider' => $integration->provider->label()]),
                ]);
            }
        }

        return $integration->userMappings()->updateOrCreate(['user_id' => $member->id], [
            'external_account_id' => $account?->id,
            'external_display_name' => $account?->displayName,
            'matched_by' => IntegrationUserMatch::Manual,
            'account_inactive' => false,
            'checked_at' => now(),
        ]);
    }
}
