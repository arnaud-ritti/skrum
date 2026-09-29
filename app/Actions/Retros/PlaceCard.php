<?php

namespace App\Actions\Retros;

use App\Models\Card;
use App\Models\Column;
use Illuminate\Support\Collection;

class PlaceCard
{
    /**
     * @return Collection<int, Card>
     */
    public function handle(Card $card, Column $column, int $index): Collection
    {
        $sourceColumnId = $card->column_id;
        $changed = collect();

        if (! $card->isTopLevel()) {
            $card->parent_card_id = null;
        }

        $siblings = $column->cards()
            ->whereNull('parent_card_id')
            ->whereKeyNot($card->id)
            ->orderBy('position')
            ->get();

        $siblings->splice(min(max($index, 0), $siblings->count()), 0, [$card]);

        foreach ($siblings->values() as $position => $sibling) {
            $sibling->column_id = $column->id;
            $sibling->position = $position;

            if ($sibling->isDirty()) {
                $sibling->save();
                $changed->push($sibling);
            }
        }

        foreach ($card->children()->get() as $child) {
            if ($child->column_id !== $column->id) {
                $child->update(['column_id' => $column->id]);
                $changed->push($child);
            }
        }

        if ($sourceColumnId !== $column->id) {
            $changed = $changed->merge($this->resequence($sourceColumnId));
        }

        return $changed->unique('id')->values();
    }

    /**
     * @return Collection<int, Card>
     */
    private function resequence(string $columnId): Collection
    {
        $changed = collect();

        $cards = Card::query()
            ->where('column_id', $columnId)
            ->whereNull('parent_card_id')
            ->orderBy('position')
            ->get();

        foreach ($cards->values() as $position => $card) {
            if ($card->position !== $position) {
                $card->update(['position' => $position]);
                $changed->push($card);
            }
        }

        return $changed;
    }
}
