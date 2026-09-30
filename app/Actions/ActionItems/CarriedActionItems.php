<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class CarriedActionItems
{
    public const Limit = 200;

    /**
     * The team's earlier follow-ups this retro reviews: items of older
     * retros, or added outside a retro before it started, that are still
     * open or were completed since it started (they stay, struck through).
     * BroadcastActionItemChange::carryingRetroIds() applies the same rule.
     *
     * @return array{items: Collection<int, ActionItem>, hasMore: bool}
     */
    public function handle(Retro $retro): array
    {
        $startedAt = $retro->created_at;

        $query = ActionItem::query()
            ->where('team_id', $retro->team_id)
            ->where(fn (Builder $query) => $query
                ->whereIn('retro_id', Retro::query()->select('id')->where('team_id', $retro->team_id)->where('created_at', '<', $startedAt))
                ->orWhere(fn (Builder $query) => $query->whereNull('retro_id')->where('created_at', '<', $startedAt)))
            ->where(fn (Builder $query) => $query->whereNull('completed_at')->orWhere('completed_at', '>=', $startedAt))
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');

        $items = ActionItemQuery::order($query)->limit(self::Limit + 1)->get();

        return ['items' => $items->take(self::Limit), 'hasMore' => $items->count() > self::Limit];
    }
}
