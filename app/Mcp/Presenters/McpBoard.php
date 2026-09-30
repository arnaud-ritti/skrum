<?php

namespace App\Mcp\Presenters;

use App\Enums\RetroPhase;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Builder;

class McpBoard
{
    /**
     * @param  Builder<Retro>  $query
     * @return Builder<Retro>
     */
    public static function withCounts(Builder $query): Builder
    {
        return $query
            ->with('team')
            ->withCount([
                'participants',
                'cards',
                'actionItems as open_action_items_count' => fn ($items) => $items->whereNull('completed_at'),
            ]);
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     teamId: string,
     *     teamName: string,
     *     phase: string,
     *     isFinished: bool,
     *     isAnonymous: bool,
     *     participantCount: int,
     *     messageCount: int,
     *     openActionItemCount: int,
     *     createdAt: ?string,
     *     completedAt: ?string,
     *     url: string
     * }
     */
    public function handle(Retro $retro): array
    {
        return [
            'id' => $retro->id,
            'title' => $retro->title,
            'teamId' => $retro->team_id,
            'teamName' => $retro->team->name,
            'phase' => $retro->phase->value,
            'isFinished' => $retro->phase === RetroPhase::Completed,
            'isAnonymous' => $retro->is_anonymous,
            'participantCount' => (int) ($retro->participants_count ?? $retro->participants()->count()),
            'messageCount' => (int) ($retro->cards_count ?? $retro->cards()->count()),
            'openActionItemCount' => (int) ($retro->open_action_items_count ?? $retro->actionItems()->whereNull('completed_at')->count()),
            'createdAt' => $retro->created_at?->toIso8601String(),
            'completedAt' => $retro->completed_at?->toIso8601String(),
            'url' => route('retros.show', $retro),
        ];
    }
}
