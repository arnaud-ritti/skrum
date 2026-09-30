<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemSubtask;

/**
 * Keeps positions contiguous (0…n-1) so a new sub-task is appended at
 * position = count.
 */
class RenumberActionItemSubtasks
{
    public function move(ActionItemSubtask $subtask, int $position): void
    {
        $orderedIds = $this->orderedIds($subtask->action_item_id, $subtask->id);

        array_splice($orderedIds, min($position, count($orderedIds)), 0, [$subtask->id]);

        $this->apply($orderedIds);
    }

    public function compact(string $actionItemId): void
    {
        $this->apply($this->orderedIds($actionItemId));
    }

    /**
     * @return array<int, string>
     */
    private function orderedIds(string $actionItemId, ?string $exceptId = null): array
    {
        /** @var array<int, string> $ids */
        $ids = ActionItemSubtask::query()
            ->where('action_item_id', $actionItemId)
            ->when($exceptId !== null, fn ($query) => $query->whereKeyNot($exceptId))
            ->orderBy('position')
            ->orderBy('created_at')
            ->pluck('id')
            ->all();

        return $ids;
    }

    /**
     * @param  array<int, string>  $orderedIds
     */
    private function apply(array $orderedIds): void
    {
        foreach ($orderedIds as $position => $id) {
            ActionItemSubtask::query()->whereKey($id)->update(['position' => $position]);
        }
    }
}
