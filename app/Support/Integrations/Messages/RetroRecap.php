<?php

namespace App\Support\Integrations\Messages;

/**
 * Everything a results recap may show (spec 6 §5.2). It is built from
 * revealed content only and holds no card author, voter or comment.
 */
class RetroRecap
{
    /**
     * @param  array<int, string>|null  $participantNames  null on anonymous retros
     * @param  array<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>  $actionItems
     * @param  array<int, string>  $suggestedActions
     * @param  array<int, array{column: string, content: string, votes: int, groupedCount: int}>  $topCards
     */
    public function __construct(
        public string $title,
        public string $teamName,
        public string $completedOn,
        public string $url,
        public int $participantCount,
        public ?array $participantNames,
        public int $cardCount,
        public ?float $rotiAverage,
        public int $rotiRespondents,
        public ?string $summary,
        public array $actionItems,
        public int $hiddenActionItems,
        public array $suggestedActions,
        public int $hiddenSuggestedActions,
        public array $topCards,
    ) {}
}
