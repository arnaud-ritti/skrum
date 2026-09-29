<?php

namespace App\Actions\Retros;

use App\Models\CardReaction;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Collection;

class SummarizeReactions
{
    /**
     * @param  Collection<int, CardReaction>  $reactions
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     mine: bool,
     *     names: array<int, string>
     * }>
     */
    public function handle(Collection $reactions, Retro $retro, ?Participant $viewer): array
    {
        return $reactions
            ->groupBy('emoji')
            ->map(fn (Collection $group, string $emoji) => [
                'emoji' => $emoji,
                'count' => $group->count(),
                'mine' => $viewer !== null && $group->contains('participant_id', $viewer->id),
                'names' => $retro->is_anonymous
                    ? []
                    : $group->map(fn (CardReaction $reaction) => $reaction->participant->displayName())->values()->all(),
            ])
            ->values()
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, CardReaction>  $reactions
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     names: array<int, string>
     * }>
     */
    public function forOthers(Collection $reactions, Retro $retro): array
    {
        return array_map(
            fn (array $summary) => ['emoji' => $summary['emoji'], 'count' => $summary['count'], 'names' => $summary['names']],
            $this->handle($reactions, $retro, null),
        );
    }
}
