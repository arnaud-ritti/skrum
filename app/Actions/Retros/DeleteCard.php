<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\CardDeleted;
use App\Events\Retros\CardGroupNamed;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

class DeleteCard
{
    public function __construct(private PresentCard $presentCard) {}

    public function handle(Retro $retro, Card $card, Participant $actor): void
    {
        RetroGuard::phase($retro, RetroPhase::Writing, RetroPhase::Grouping);
        RetroGuard::unlocked($retro);
        RetroGuard::author($card, $actor);

        DB::transaction(function () use ($retro, $card, $actor): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Writing, RetroPhase::Grouping);
            RetroGuard::unlocked($locked);

            $card = $locked->cards()->whereKey($card->id)->firstOrFail();

            RetroGuard::author($card, $actor);

            $formerLeadId = $card->parent_card_id;
            $children = $card->children()->orderBy('position')->get();

            $card->delete();

            $ungroupedCards = $children->map(function (Card $child) use ($locked): array {
                $lastPosition = $locked->cards()
                    ->where('column_id', $child->column_id)
                    ->whereNull('parent_card_id')
                    ->max('position');

                $child->parent_card_id = null;
                $child->position = $lastPosition === null ? 0 : $lastPosition + 1;
                $child->save();

                return $this->presentCard->handle($child, $locked, null);
            })->all();

            new CardDeleted($locked->id, $card->id, $ungroupedCards, $locked->writersCount())->sendToOthers();

            $formerLead = $formerLeadId === null ? null : $locked->cards()->whereKey($formerLeadId)->first();

            if ($formerLead !== null && $formerLead->clearGroupNameWhenEmpty()) {
                new CardGroupNamed($locked->id, $formerLead->id, null)->sendToOthers();
            }
        });
    }
}
