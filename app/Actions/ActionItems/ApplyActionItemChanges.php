<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;

/**
 * One PATCH from the board or the workspace: field changes need edit
 * rights, a status change needs completion rights.
 */
class ApplyActionItemChanges
{
    public function __construct(
        private ResolveActionItemAssignee $resolveActionItemAssignee,
        private UpdateActionItem $updateActionItem,
        private SetActionItemStatus $setActionItemStatus,
    ) {}

    /**
     * @param  array<string, mixed>  $validated  the output of ActionItemRules::update()
     */
    public function handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem
    {
        $changes = [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($locked->team, $locked->retro, $validated, $locked) ?? []),
        ];

        if ($changes !== []) {
            $locked = $this->updateActionItem->handle($locked, $actor, $changes);
        }

        if (array_key_exists('status', $validated)) {
            return $this->setActionItemStatus->handle($locked, $actor, ActionItemStatus::from((string) $validated['status']));
        }

        return $locked->loadForPresentation();
    }
}
