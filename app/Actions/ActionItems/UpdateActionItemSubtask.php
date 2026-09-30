<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;

class UpdateActionItemSubtask
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private RenumberActionItemSubtasks $renumberActionItemSubtasks,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * Text and order need edit rights; ticking needs completion rights.
     * Checking every sub-task never completes the item.
     *
     * @param  array<string, mixed>  $validated  the output of ActionItemSubtaskRules::update()
     */
    public function handle(ActionItem $locked, ActionItemSubtask $subtask, ActionItemActor $actor, array $validated): ActionItem
    {
        if ($validated === []) {
            return $locked->loadForPresentation();
        }

        if (array_key_exists('content', $validated) || array_key_exists('position', $validated)) {
            $this->permissions->authorizeEdit($locked, $actor);
        }

        if (array_key_exists('status', $validated)) {
            $this->permissions->authorizeComplete($locked, $actor);
        }

        if (array_key_exists('content', $validated)) {
            $subtask->fill(['content' => (string) $validated['content']]);
        }

        if (array_key_exists('status', $validated)) {
            $subtask->fill(['completed_at' => $validated['status'] === ActionItemStatus::Completed->value
                ? ($subtask->completed_at ?? now())
                : null]);
        }

        $subtask->save();

        if (array_key_exists('position', $validated)) {
            $this->renumberActionItemSubtasks->move($subtask, (int) $validated['position']);
        }

        $locked->touch();

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
