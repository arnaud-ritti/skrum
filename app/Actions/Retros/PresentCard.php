<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;

class PresentCard
{
    /**
     * @return array{
     *     id: string,
     *     columnId: string,
     *     parentCardId: ?string,
     *     position: int,
     *     isMine: bool,
     *     content: ?string,
     *     author: ?array{id: string, name: string}
     * }
     */
    public function handle(Card $card, Retro $retro, ?Participant $viewer): array
    {
        $isMine = $viewer !== null && $card->participant_id === $viewer->id;
        $isHidden = ! $isMine && $retro->phase === RetroPhase::Writing;
        $showsAuthor = ! $isHidden && ($isMine || ! $retro->is_anonymous);

        return [
            'id' => $card->id,
            'columnId' => $card->column_id,
            'parentCardId' => $card->parent_card_id,
            'position' => $card->position,
            'isMine' => $isMine,
            'content' => $isHidden ? null : $card->content,
            'author' => $showsAuthor
                ? ['id' => $card->participant_id, 'name' => $card->participant->displayName()]
                : null,
        ];
    }
}
