<?php

namespace App\Mcp\Presenters;

use App\Actions\Retros\PresentCard;
use App\Actions\Retros\SummarizeReactions;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Llm\Llm;

class McpMessage
{
    public function __construct(
        private PresentCard $presentCard,
        private SummarizeReactions $summarizeReactions,
        private Llm $llm,
    ) {}

    /**
     * @return array<int|string, mixed>
     */
    public static function eagerLoads(): array
    {
        $relations = ['participant.user', 'reactions', 'comments'];

        return [...$relations, 'children' => fn ($query) => $query->with($relations)];
    }

    /**
     * @return array<string, int>|null
     */
    public function voteTotals(Retro $retro): ?array
    {
        if (! $retro->showsVoteTotals()) {
            return null;
        }

        return $retro->votes()
            ->selectRaw('card_id, count(*) as total')
            ->groupBy('card_id')
            ->pluck('total', 'card_id')
            ->map(fn (mixed $total) => (int) $total)
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function presentFresh(Card $card, Retro $retro, ?Participant $viewer): array
    {
        $card->load(self::eagerLoads());

        return $this->handle($card, $retro, $viewer, $this->voteTotals($retro));
    }

    /**
     * Reactions are counted, never named: MCP output leaves the board.
     *
     * @param  array<string, int>|null  $voteTotals
     * @return array<string, mixed>
     */
    public function handle(Card $card, Retro $retro, ?Participant $viewer, ?array $voteTotals): array
    {
        $presented = $this->presentCard->handle($card, $retro, $viewer);
        $isHidden = $presented['hidden'];
        $showsInsights = $this->llm->isConfigured() && ! $isHidden;

        return [
            'id' => $presented['id'],
            'hidden' => $isHidden,
            'content' => $presented['content'],
            'author' => $presented['author'],
            'isMine' => $presented['isMine'],
            'votes' => $voteTotals === null ? null : ($voteTotals[$card->id] ?? 0),
            'sentiment' => $showsInsights ? $card->sentiment?->value : null,
            'category' => $showsInsights ? $card->category : null,
            'groupName' => $presented['groupName'],
            'reactions' => $isHidden ? [] : array_map(
                fn (array $reaction) => ['emoji' => $reaction['emoji'], 'count' => $reaction['count']],
                $this->summarizeReactions->handle($card->reactions, $retro, $viewer, showsNames: false),
            ),
            'commentCount' => $isHidden ? 0 : $card->comments->reject(fn (CardComment $comment) => $comment->isDeleted())->count(),
            'gif' => $presented['gif'] === null ? null : ['url' => url($presented['gif']['url'])],
            'grouped' => $card->children
                ->sortBy('position')
                ->map(fn (Card $child) => $this->handle($child, $retro, $viewer, $voteTotals))
                ->values()
                ->all(),
        ];
    }
}
