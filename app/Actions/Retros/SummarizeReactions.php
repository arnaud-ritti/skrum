<?php

namespace App\Actions\Retros;

use App\Models\CardReaction;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SurveyReaction;
use Illuminate\Support\Collection;

class SummarizeReactions
{
    /**
     * Names are shown on named retros unless the caller decides otherwise
     * (surveys only name reactions when "Show who answered" is on).
     *
     * @template TReaction of CardReaction|SurveyReaction
     *
     * @param  Collection<int, TReaction>  $reactions
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     mine: bool,
     *     names: array<int, string>
     * }>
     */
    public function handle(Collection $reactions, Retro $retro, ?Participant $viewer, ?bool $showsNames = null): array
    {
        $showsNames ??= ! $retro->is_anonymous;

        return $reactions
            ->groupBy('emoji')
            ->map(fn (Collection $group, string $emoji): array => [
                'emoji' => $emoji,
                'count' => $group->count(),
                'mine' => $viewer !== null && $group->contains('participant_id', $viewer->id),
                'names' => $showsNames
                    ? $group->map(fn (CardReaction|SurveyReaction $reaction) => $reaction->participant->displayName())->values()->all()
                    : [],
            ])
            ->values()
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * @template TReaction of CardReaction|SurveyReaction
     *
     * @param  Collection<int, TReaction>  $reactions
     * @return array<int, array{
     *     emoji: string,
     *     count: int,
     *     names: array<int, string>
     * }>
     */
    public function forOthers(Collection $reactions, Retro $retro, ?bool $showsNames = null): array
    {
        return array_map(
            fn (array $summary): array => ['emoji' => $summary['emoji'], 'count' => $summary['count'], 'names' => $summary['names']],
            $this->handle($reactions, $retro, null, $showsNames),
        );
    }
}
