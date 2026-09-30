<?php

namespace App\Actions\Integrations;

use App\Jobs\MatchIntegrationUsers;
use App\Models\IntegrationUserMapping;
use App\Models\TeamIntegration;
use App\Models\User;

class PresentIntegrationUserMappings
{
    /**
     * Current team members only; rows of former members are kept but not
     * listed (spec §3).
     *
     * @return array{
     *     members: array<int, array{
     *         userId: string,
     *         name: string,
     *         email: string,
     *         avatarUrl: string,
     *         mapping: ?array{accountId: ?string, displayName: ?string, matchedBy: string, accountInactive: bool}
     *     }>,
     *     matching: bool
     * }
     */
    public function handle(TeamIntegration $integration): array
    {
        $mappings = $integration->userMappings()->get()->keyBy('user_id');
        $members = $integration->team->members()->orderBy('name')->get();

        return [
            'members' => $members
                ->map(fn (User $member): array => $this->member($member, $mappings->get($member->id)))
                ->values()
                ->all(),
            'matching' => MatchIntegrationUsers::isRunning($integration),
        ];
    }

    /**
     * @return array{
     *     userId: string,
     *     name: string,
     *     email: string,
     *     avatarUrl: string,
     *     mapping: ?array{accountId: ?string, displayName: ?string, matchedBy: string, accountInactive: bool}
     * }
     */
    public function member(User $member, ?IntegrationUserMapping $mapping): array
    {
        return [
            'userId' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'avatarUrl' => $member->avatarUrl(),
            'mapping' => $mapping === null ? null : [
                'accountId' => $mapping->external_account_id,
                'displayName' => $mapping->external_display_name,
                'matchedBy' => $mapping->matched_by->value,
                'accountInactive' => $mapping->account_inactive,
            ],
        ];
    }
}
