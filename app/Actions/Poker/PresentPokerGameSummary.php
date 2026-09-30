<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresentPokerGameSummary
{
    /**
     * @template TQuery of HasMany<PokerGame, *>|Builder<PokerGame>
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    public static function withCounts(HasMany|Builder $query): HasMany|Builder
    {
        return $query
            ->withCount(['tasks', 'tasks as estimated_tasks_count' => fn (Builder $tasks) => $tasks->whereNotNull('estimated_at')])
            ->withSum('tasks as total_points', 'estimate_numeric');
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     deckLabel: string,
     *     tasksCount: int,
     *     estimatedCount: int,
     *     totalPoints: ?float,
     *     endedAt: ?string,
     *     lastActivityAt: string
     * }
     */
    public function handle(PokerGame $game): array
    {
        return [
            'id' => $game->id,
            'title' => $game->title,
            'deckLabel' => $game->deckLabel(),
            'tasksCount' => (int) $game->getAttribute('tasks_count'),
            'estimatedCount' => (int) $game->getAttribute('estimated_tasks_count'),
            'totalPoints' => $game->isNumeric() ? round((float) $game->getAttribute('total_points'), 2) : null,
            'endedAt' => $game->ended_at?->toIso8601String(),
            'lastActivityAt' => $game->updated_at?->toIso8601String() ?? '',
        ];
    }
}
