<?php

namespace App\Actions\ActionItems;

use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemCommentsChanged;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemCommentsChanged;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemCommentsChanged;
use App\Events\Retros\CarriedActionItemRemoved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItem;
use App\Models\Retro;

/**
 * One place decides who hears about an item: its own board while that
 * retro runs, every running retro that carries it, and the team channel of
 * the global page. Payloads are presented without a viewer.
 */
class BroadcastActionItemChange
{
    public function __construct(private PresentActionItem $presentActionItem) {}

    public function saved(ActionItem $item): void
    {
        $item->loadForPresentation();
        $payload = $this->presentActionItem->handle($item);

        if ($this->hasRunningBoard($item)) {
            (new ActionItemSaved((string) $item->retro_id, $payload))->sendToOthers();
        }

        foreach ($this->carryingRetroIds($item) as $retroId) {
            (new CarriedActionItemSaved($retroId, $payload))->sendToOthers();
        }

        (new TeamActionItemSaved($item->team_id, $payload))->sendToOthers();
    }

    /**
     * Called after the delete: the model keeps its attributes.
     */
    public function deleted(ActionItem $item): void
    {
        if ($this->hasRunningBoard($item)) {
            (new ActionItemDeleted((string) $item->retro_id, $item->id))->sendToOthers();
        }

        foreach ($this->carryingRetroIds($item) as $retroId) {
            (new CarriedActionItemRemoved($retroId, $item->id))->sendToOthers();
        }

        (new TeamActionItemDeleted($item->team_id, $item->id))->sendToOthers();
    }

    public function commentsChanged(ActionItem $item): void
    {
        $commentCount = $item->comments()->count();

        if ($this->hasRunningBoard($item)) {
            (new ActionItemCommentsChanged((string) $item->retro_id, $item->id, $commentCount))->sendToOthers();
        }

        foreach ($this->carryingRetroIds($item) as $retroId) {
            (new CarriedActionItemCommentsChanged($retroId, $item->id, $commentCount))->sendToOthers();
        }

        (new TeamActionItemCommentsChanged($item->team_id, $item->id, $commentCount))->sendToOthers();
    }

    /**
     * The running retros of the item's team that list it as a previous
     * action item (same rule as CarriedActionItems).
     *
     * @return array<int, string>
     */
    public function carryingRetroIds(ActionItem $item): array
    {
        $anchor = $item->hasRetro() ? $item->retro->created_at : $item->created_at;

        /** @var array<int, string> $retroIds */
        $retroIds = Retro::query()
            ->where('team_id', $item->team_id)
            ->where('phase', '!=', RetroPhase::Completed->value)
            ->where('created_at', '>', $anchor)
            ->when($item->completed_at !== null, fn ($query) => $query->where('created_at', '<=', $item->completed_at))
            ->orderBy('created_at')
            ->pluck('id')
            ->all();

        return $retroIds;
    }

    private function hasRunningBoard(ActionItem $item): bool
    {
        return $item->retro !== null && $item->retro->phase !== RetroPhase::Completed;
    }
}
