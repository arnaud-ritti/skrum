<?php

namespace App\Actions\Poker;

use App\Actions\Integrations\PokerImportBatch;
use App\Enums\PokerDeck;

readonly class NewPokerGame
{
    /**
     * @param  array<int, string>  $cards
     * @param  array<int, string>  $tasks
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
        public bool $guestAccessEnabled = false,
        public bool $spectator = false,
        public array $tasks = [],
        public bool $revoteAfterReveal = false,
        public ?int $taskTimerSeconds = null,
        public bool $writesEstimates = true,
        public ?string $estimateFieldId = null,
        public ?PokerImportBatch $import = null,
    ) {}
}
