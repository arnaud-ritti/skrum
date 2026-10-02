<?php

namespace App\Actions\Search;

use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Whiteboard;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * @phpstan-type RecentSession array{
 *     kind: string,
 *     id: string,
 *     title: string,
 *     team: array{id: string, name: string},
 *     url: string,
 *     updatedAt: string,
 *     live: bool
 * }
 */
class ListRecentSessions
{
    public const int Limit = 5;

    public const int LiveWithinMinutes = 15;

    /**
     * Every query starts from the ids of the given teams: what the caller
     * may not view is never listed. A live session is one that is not
     * ended and was touched in the last minutes; a whiteboard never ends.
     * Icebreaker rooms have no name and belong to their retro.
     *
     * @param  Collection<int, Team>  $teams  teams of one workspace
     * @return array<int, RecentSession>
     */
    public function handle(Collection $teams): array
    {
        if ($teams->isEmpty()) {
            return [];
        }

        $teamIds = $teams->modelKeys();
        $teamsById = $teams->keyBy('id');

        $retros = $this->recent(
            Retro::query()->whereIn('team_id', $teamIds),
            fn (Builder $query) => $query->where('phase', '!=', RetroPhase::Completed->value),
            fn (Retro $retro, bool $live): array => $this->session('retro', $retro, $retro->title, $teamsById[$retro->team_id], route('retros.show', $retro), $live),
        );

        $games = $this->recent(
            PokerGame::query()->whereIn('team_id', $teamIds),
            fn (Builder $query) => $query->whereNull('ended_at'),
            fn (PokerGame $game, bool $live): array => $this->session('poker', $game, $game->title, $teamsById[$game->team_id], route('poker.show', $game), $live),
        );

        $boards = $this->recent(
            Whiteboard::query()->whereIn('team_id', $teamIds),
            fn (Builder $query) => $query,
            fn (Whiteboard $board, bool $live): array => $this->session('whiteboard', $board, $board->title, $teamsById[$board->team_id], route('whiteboards.show', $board), $live),
        );

        $rooms = $this->recent(
            GameRoom::query()->whereIn('team_id', $teamIds)->whereNotNull('name'),
            fn (Builder $query) => $query->whereNotNull('current_round_id'),
            fn (GameRoom $room, bool $live): array => $this->session('game', $room, (string) $room->name, $teamsById[$room->team_id], route('games.show', $room), $live),
        );

        return collect([$retros, $games, $boards, $rooms])
            ->flatten(1)
            ->sortBy([['live', 'desc'], ['updatedAt', 'desc']])
            ->take(self::Limit)
            ->values()
            ->all();
    }

    /**
     * The live sessions of a kind are read apart from its last touched
     * ones, so that five ended sessions never push a live one out.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @param  Closure(Builder<TModel>): Builder<TModel>  $notEnded
     * @param  Closure(TModel, bool): RecentSession  $present
     * @return Collection<int, RecentSession>
     */
    private function recent(Builder $query, Closure $notEnded, Closure $present): Collection
    {
        $live = $notEnded((clone $query)->where('updated_at', '>=', now()->subMinutes(self::LiveWithinMinutes)))
            ->latest('updated_at')
            ->limit(self::Limit)
            ->get();
        $lastTouched = $query->latest('updated_at')->limit(self::Limit)->get();

        return $live
            ->concat($lastTouched->whereNotIn('id', $live->modelKeys()))
            ->map(fn (Model $session): array => $present($session, $live->contains('id', $session->getKey())))
            ->values()
            ->toBase();
    }

    /**
     * @return RecentSession
     */
    private function session(string $kind, Model $session, string $title, Team $team, string $url, bool $live): array
    {
        return [
            'kind' => $kind,
            'id' => (string) $session->getKey(),
            'title' => $title,
            'team' => ['id' => $team->id, 'name' => $team->name],
            'url' => $url,
            'updatedAt' => (string) $session->getAttribute('updated_at')?->toIso8601String(),
            'live' => $live,
        ];
    }
}
