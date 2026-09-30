<?php

namespace App\Actions\Retros;

use App\Models\Card;
use App\Models\Vote;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class GroupCard
{
    /**
     * @return Collection<int, Card>
     */
    public function group(Card $card, Card $lead): Collection
    {
        if ($lead->is($card)) {
            throw ValidationException::withMessages(['parent_card_id' => __('A card cannot be grouped with itself.')]);
        }

        if (! $lead->isTopLevel()) {
            throw ValidationException::withMessages(['parent_card_id' => __('Cards can only be grouped under a card that is not grouped itself.')]);
        }

        $formerLead = $card->isTopLevel() ? null : $card->parent()->first();
        $movedName = $card->group_name;
        $movedCards = $card->children()->get()->push($card);

        Vote::query()->whereIn('card_id', $movedCards->pluck('id'))->update(['card_id' => $lead->id]);

        foreach ($movedCards as $moved) {
            $moved->update([
                'parent_card_id' => $lead->id,
                'column_id' => $lead->column_id,
                'group_name' => null,
            ]);
        }

        if ($lead->group_name === null && $movedName !== null) {
            $lead->update(['group_name' => $movedName]);
        }

        if ($formerLead !== null && ! $formerLead->is($lead) && $formerLead->clearGroupNameWhenEmpty()) {
            $movedCards->push($formerLead);
        }

        return $movedCards->push($lead);
    }

    /**
     * @return Collection<int, Card>
     */
    public function ungroup(Card $card): Collection
    {
        if ($card->isTopLevel()) {
            throw ValidationException::withMessages(['card' => __('This card is not grouped.')]);
        }

        $formerLead = $card->parent()->firstOrFail();

        $lastPosition = Card::query()
            ->where('column_id', $card->column_id)
            ->whereNull('parent_card_id')
            ->max('position');

        $card->update([
            'parent_card_id' => null,
            'position' => $lastPosition === null ? 0 : $lastPosition + 1,
        ]);

        $formerLead->clearGroupNameWhenEmpty();

        return collect([$card, $formerLead]);
    }
}
