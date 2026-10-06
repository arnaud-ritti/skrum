<?php

namespace App\Actions\Search;

use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * @phpstan-type SearchResult array{
 *     kind: string,
 *     id: string,
 *     title: string,
 *     team: array{id: string, name: string},
 *     url: string,
 *     context: ?string
 * }
 */
class SearchWorkspaceContent
{
    public const int PerKind = 5;

    private const int RowsPerRead = 20;

    /**
     * SQL answers every true match and, for a term holding a wildcard character, some near ones:
     * each kind is read newest first until PerKind true matches are found, and never past this.
     */
    private const int MaxRowsRead = 200;

    /**
     * Every query starts from the ids of the given teams: what the caller
     * may not view cannot match. A card of a retro that still hides the
     * others' cards matches only for its author. A survey matches once it
     * is open or closed: a draft is its editors' alone, and the surveys of
     * a retro belong to it. Whiteboard elements are not searched.
     *
     * @param  Collection<int, Team>  $teams  teams of one workspace
     * @return array<int, SearchResult>
     */
    public function handle(Collection $teams, string $term, User $user): array
    {
        if ($teams->isEmpty()) {
            return [];
        }

        $teamIds = $teams->pluck('id')->all();
        $teamsById = $teams->keyBy('id');
        $workspace = $teams->first()->workspace;
        $termHasWildcard = SearchText::hasWildcard($term);

        $retros = Retro::query()->whereIn('team_id', $teamIds)->whereContains('title', $term)
            ->latest()->orderByDesc('id')->select(['id', 'team_id', 'title'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (Retro $retro): bool => SearchText::contains($retro->title, $term))
            ->take(self::PerKind)->collect()
            ->map(fn (Retro $retro): array => $this->result('retro', $retro->id, $retro->title, $teamsById[$retro->team_id], route('retros.show', $retro)));

        $games = PokerGame::query()->whereIn('team_id', $teamIds)
            ->where(fn (Builder $query) => $query
                ->whereContains('title', $term)
                ->orWhereHas('tasks', fn (Builder $tasks) => $tasks->whereContains('title', $term)))
            ->when($termHasWildcard, fn (Builder $query) => $query->with([
                'tasks' => fn (Relation $tasks) => $tasks->whereContains('title', $term)->select(['id', 'poker_game_id', 'title']),
            ]))
            ->latest()->orderByDesc('id')->select(['id', 'team_id', 'title'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (PokerGame $game): bool => ! $termHasWildcard
                || SearchText::contains($game->title, $term)
                || $game->tasks->contains(fn (PokerTask $task): bool => SearchText::contains($task->title, $term)))
            ->take(self::PerKind)->collect()
            ->map(fn (PokerGame $game): array => $this->result('poker', $game->id, $game->title, $teamsById[$game->team_id], route('poker.show', $game)));

        $boards = Whiteboard::query()->whereIn('team_id', $teamIds)->whereContains('title', $term)
            ->latest('updated_at')->orderByDesc('id')->select(['id', 'team_id', 'title'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (Whiteboard $board): bool => SearchText::contains($board->title, $term))
            ->take(self::PerKind)->collect()
            ->map(fn (Whiteboard $board): array => $this->result('whiteboard', $board->id, $board->title, $teamsById[$board->team_id], route('whiteboards.show', $board)));

        $rooms = GameRoom::query()->whereIn('team_id', $teamIds)->whereContains('name', $term)
            ->latest()->orderByDesc('id')->select(['id', 'team_id', 'name'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (GameRoom $room): bool => SearchText::contains($room->name, $term))
            ->take(self::PerKind)->collect()
            ->map(fn (GameRoom $room): array => $this->result('game', $room->id, (string) $room->name, $teamsById[$room->team_id], route('games.show', $room)));

        // ponytail: surveys have no folded title column, so the newest MaxRowsRead are matched here; give TeamSurvey a title_search column (HasSearchColumns) when a workspace outgrows that.
        $surveys = TeamSurvey::query()->whereIn('team_id', $teamIds)->whereNull('retro_id')
            ->where('status', '!=', TeamSurveyStatus::Draft->value)
            ->latest()->orderByDesc('id')->select(['id', 'team_id', 'title'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (TeamSurvey $survey): bool => SearchText::contains($survey->title, $term))
            ->take(self::PerKind)->collect()
            ->map(fn (TeamSurvey $survey): array => $this->result('survey', $survey->id, $survey->title, $teamsById[$survey->team_id], route('surveys.show', $survey)));

        $items = ActionItem::query()->whereIn('team_id', $teamIds)->whereContains('content', $term)
            ->latest()->orderByDesc('id')->select(['id', 'team_id', 'content'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (ActionItem $item): bool => SearchText::contains($item->content, $term))
            ->take(self::PerKind)->collect()
            ->map(fn (ActionItem $item): array => $this->result('action', $item->id, $item->content, $teamsById[$item->team_id], route('workspaces.actionItems.index', ['workspace' => $workspace, 'item' => $item->id])));

        $ownParticipantIds = Participant::query()->where('user_id', $user->id)->select('id');
        $hidingRetroIds = Retro::query()->whereIn('phase', RetroPhase::hidingOthersCards())->select('id');

        $cards = Card::query()
            ->with('retro:id,team_id,title')
            ->whereIn('retro_id', Retro::query()->whereIn('team_id', $teamIds)->select('id'))
            ->whereContains('content', $term)
            ->where(fn (Builder $query) => $query
                ->whereNotIn('retro_id', $hidingRetroIds)
                ->orWhereIn('participant_id', $ownParticipantIds))
            ->latest()->orderByDesc('id')->select(['id', 'retro_id', 'content'])->lazy(self::RowsPerRead)->take(self::MaxRowsRead)
            ->filter(fn (Card $card): bool => SearchText::contains($card->content, $term))
            ->take(self::PerKind)->collect()
            ->map(fn (Card $card): array => $this->result(
                'card',
                $card->id,
                Str::limit(Str::squish($card->content), 120),
                $teamsById[$card->retro->team_id],
                route('retros.show', $card->retro),
                $card->retro->title,
            ));

        return collect([$retros, $games, $boards, $rooms, $surveys, $items, $cards])->flatten(1)->values()->all();
    }

    /**
     * @return SearchResult
     */
    private function result(string $kind, string $id, string $title, Team $team, string $url, ?string $context = null): array
    {
        return [
            'kind' => $kind,
            'id' => $id,
            'title' => $title,
            'team' => ['id' => $team->id, 'name' => $team->name],
            'url' => $url,
            'context' => $context,
        ];
    }
}
