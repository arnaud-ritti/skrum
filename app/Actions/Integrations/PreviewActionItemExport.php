<?php

namespace App\Actions\Integrations;

use App\Models\ActionItem;
use App\Models\TeamIntegration;

/**
 * What the export dialog announces, from stored data only (no provider
 * call, spec §7.3).
 */
class PreviewActionItemExport
{
    public function __construct(private ResolveExportPriority $resolvePriority) {}

    /**
     * @return array{assignee: array{state: string, displayName: ?string}, priority: array{name: ?string}}
     */
    public function handle(ActionItem $item, TeamIntegration $integration): array
    {
        return [
            'assignee' => $this->assignee($item, $integration),
            'priority' => ['name' => $this->resolvePriority->preview($item, $integration)],
        ];
    }

    /**
     * @return array{state: string, displayName: ?string}
     */
    private function assignee(ActionItem $item, TeamIntegration $integration): array
    {
        if ($item->assignee_participant_id !== null) {
            return ['state' => 'guest', 'displayName' => null];
        }

        $user = $item->assigneeUser;

        if ($user === null) {
            return ['state' => 'none', 'displayName' => null];
        }

        $mapping = $integration->accountFor($user);

        if ($mapping !== null && $mapping->isNeverAssign()) {
            return ['state' => 'never', 'displayName' => null];
        }

        if ($mapping !== null && $mapping->external_account_id !== null) {
            return ['state' => 'mapped', 'displayName' => $mapping->external_display_name];
        }

        if ($mapping === null && ResolveExportAssignee::canLookUp($integration, $user)) {
            return ['state' => 'willMatch', 'displayName' => $user->name];
        }

        return ['state' => 'none', 'displayName' => null];
    }
}
