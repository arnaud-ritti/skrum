<?php

namespace App\Actions\Notifications;

use App\Actions\Integrations\BuildRetroRecap;
use App\Models\Retro;
use App\Notifications\RetroResultsNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;

class PresentRecapNotifications
{
    /**
     * The retro is read live; a recap of a team the user can no longer
     * view is left out. The ROTI follows the recap mail: under three
     * votes an average would show who voted what.
     *
     * @param  Collection<int, DatabaseNotification>  $notifications
     * @param  array<int, string>  $viewableTeamIds
     * @return array<string, array{
     *     team: string,
     *     session: array{id: string, title: string},
     *     actionsCount: int,
     *     roti: ?float,
     *     href: string
     * }>
     */
    public function handle(Collection $notifications, array $viewableTeamIds): array
    {
        $recaps = $notifications->filter(
            fn (DatabaseNotification $notification): bool => ($notification->data['kind'] ?? null) === RetroResultsNotification::Kind,
        );

        if ($recaps->isEmpty()) {
            return [];
        }

        $retros = Retro::query()
            ->with('team:id,name')
            ->withCount(['actionItems', 'rotiVotes'])
            ->withAvg('rotiVotes', 'score')
            ->whereKey($recaps->pluck('data.retroId')->filter()->unique())
            ->whereIn('team_id', $viewableTeamIds)
            ->get()
            ->keyBy('id');

        return $recaps
            ->filter(fn (DatabaseNotification $notification): bool => $retros->has($notification->data['retroId'] ?? ''))
            ->mapWithKeys(fn (DatabaseNotification $notification): array => [
                $notification->id => $this->present($retros[$notification->data['retroId']]),
            ])
            ->all();
    }

    /**
     * @return array{
     *     team: string,
     *     session: array{id: string, title: string},
     *     actionsCount: int,
     *     roti: ?float,
     *     href: string
     * }
     */
    private function present(Retro $retro): array
    {
        return [
            'team' => $retro->team->name,
            'session' => ['id' => $retro->id, 'title' => $retro->title],
            'actionsCount' => (int) $retro->getAttribute('action_items_count'),
            'roti' => $this->roti($retro),
            'href' => route('retros.show', $retro),
        ];
    }

    private function roti(Retro $retro): ?float
    {
        if ((int) $retro->roti_votes_count < BuildRetroRecap::RotiBarsMinimumVotes) {
            return null;
        }

        return round((float) $retro->roti_votes_avg_score, 1);
    }
}
