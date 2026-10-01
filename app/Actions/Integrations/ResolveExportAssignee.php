<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Enums\SsoProvider;
use App\Exceptions\Integrations\IntegrationException;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Models\User;
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
            'matched_by' => $integration->provider === IntegrationProvider::GitHub ? IntegrationUserMatch::Sso : IntegrationUserMatch::Email,
            'account_inactive' => false,
            'checked_at' => now(),
        ]);

        return ExportAssignee::assigned($account->id, $user->name);
    }

    /**
     * Whether an export may look this member up: GitHub through their
     * GitHub sign-in, the others by verified email.
     */
    public static function canLookUp(TeamIntegration $integration, User $user): bool
    {
        if ($integration->provider === IntegrationProvider::GitHub) {
            return $user->socialAccounts()->where('provider', SsoProvider::GitHub->value)->exists();
        }

        return $user->email_verified_at !== null && IntegrationMappingGuard::hasAccountScope($integration);
    }

    private function lookUp(TeamIntegration $integration, User $user): ?ExternalAccount
    {
        if (! self::canLookUp($integration, $user)) {
            return null;
        }

        try {
            return $integration->provider === IntegrationProvider::GitHub
                ? $this->accounts->matchSso($integration, [$user])[$user->id] ?? null
                : $this->accounts->matchEmails($integration, [$user->email])[Str::lower($user->email)] ?? null;
        } catch (IntegrationException) {
            return null;
        }
    }
}
