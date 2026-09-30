<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationUserMatch;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Support\Str;

/**
 * Spec §7.1 resolution at export time. The one lazy lookup never fails
 * the export: any provider error leaves the issue unassigned.
 */
class ResolveExportAssignee
{
    public function __construct(private IntegrationUserAccounts $accounts) {}

    public function handle(ActionItem $item, TeamIntegration $integration): ExportAssignee
    {
        if ($item->assignee_participant_id !== null) {
            return ExportAssignee::unassigned(ExportWarningCode::GuestAssignee);
        }

        $user = $item->assigneeUser;

        if ($user === null) {
            return ExportAssignee::unassigned();
        }

        $mapping = $integration->accountFor($user);

        if ($mapping !== null && $mapping->isNeverAssign()) {
            return ExportAssignee::unassigned(ExportWarningCode::NeverAssign, $user->name);
        }

        if ($mapping !== null && $mapping->external_account_id !== null) {
            return ExportAssignee::assigned($mapping->external_account_id, $user->name);
        }

        $account = $mapping === null ? $this->lookUp($integration, $user) : null;

        if ($account === null) {
            return ExportAssignee::unassigned(ExportWarningCode::NotMapped, $user->name);
        }

        $integration->userMappings()->firstOrCreate(['user_id' => $user->id], [
            'external_account_id' => $account->id,
            'external_display_name' => $account->displayName,
            'matched_by' => IntegrationUserMatch::Email,
            'account_inactive' => false,
            'checked_at' => now(),
        ]);

        return ExportAssignee::assigned($account->id, $user->name);
    }

    private function lookUp(TeamIntegration $integration, User $user): ?ExternalAccount
    {
        if ($user->email_verified_at === null) {
            return null;
        }

        if (! IntegrationMappingGuard::hasAccountScope($integration)) {
            return null;
        }

        try {
            return $this->accounts->matchEmails($integration, [$user->email])[Str::lower($user->email)] ?? null;
        } catch (IntegrationException) {
            return null;
        }
    }
}
