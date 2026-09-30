<?php

namespace App\Actions\Retros;

use App\Enums\CardSentiment;

class SummaryOutput
{
    /**
     * @param  array<int, array{name: string, cardIds: array<int, string>}>  $themes
     * @param  array<int, array{content: string, theme: ?string}>  $suggestedActions
     * @param  array<string, array{sentiment: ?CardSentiment, category: ?string}>  $cardInsights
     */
    public function __construct(
        public string $summary,
        public array $themes,
        public array $suggestedActions,
        public array $cardInsights,
    ) {}
}
