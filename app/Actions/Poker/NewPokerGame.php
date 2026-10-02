<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;

readonly class NewPokerGame
{
    /**
     * @param  array<int, string>  $cards
     */
    public function __construct(
        public string $title,
        public PokerDeck $deck,
        public array $cards,
        public ?string $deckName = null,
        public bool $anonymousVotes = false,
        public bool $autoReveal = false,
        public ?string $saveDeckAs = null,
        public ?string $savedDeckId = null,
    ) {}
}
