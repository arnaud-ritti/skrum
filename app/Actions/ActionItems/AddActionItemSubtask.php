<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use Illuminate\Validation\ValidationException;

class AddActionItemSubtask
{
    public const Limit = 20;

    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItem $locked, ActionItemActor $actor, string $content): ActionItem
    {
        $this->permissions->authorizeEdit($locked, $actor);

        $count = ActionItemSubtask::query()->where('action_item_id', $locked->id)->count();

        if ($count >= self::Limit) {
            throw ValidationException::withMessages([
                'content' => __('An action item can have at most 20 sub-tasks.'),
            ]);
        }

        $locked->subtasks()->create(['content' => $content, 'position' => $count]);
        $locked->touch();

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
