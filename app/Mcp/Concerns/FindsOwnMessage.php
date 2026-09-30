<?php

namespace App\Mcp\Concerns;

use App\Mcp\McpContext;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Database\Eloquent\ModelNotFoundException;

trait FindsOwnMessage
{
    /**
     * Another person's message, or a message on a board the user never
     * joined, does not exist for them.
     *
     * @return array{0: Card, 1: Retro, 2: Participant}
     */
    private function ownMessage(McpContext $context, string $messageId): array
    {
        $card = Card::query()->whereKey($messageId)->first();

        if ($card === null) {
            throw (new ModelNotFoundException)->setModel(Card::class, [$messageId]);
        }

        $retro = $context->retro($card->retro_id);
        $participant = $context->participant($retro);

        if ($participant === null || $card->participant_id !== $participant->id) {
            throw (new ModelNotFoundException)->setModel(Card::class, [$messageId]);
        }

        return [$card, $retro, $participant];
    }
}
