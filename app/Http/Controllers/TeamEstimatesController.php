<?php

namespace App\Http\Controllers;

use App\Actions\Poker\PresentPokerRound;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamEstimatesController extends Controller
{
    private const int PerPage = 50;

    public function __construct(private PresentPokerRound $presentPokerRound) {}

    public function index(Request $request, Workspace $workspace, Team $team): Response
    {
        Gate::authorize('view', $team);

        $user = $request->user();
        $games = $team->pokerGames()->latest()->get(['id', 'team_id', 'title', 'created_at']);
        $gameId = $this->gameFilter($request, $games);
        $search = $this->searchFilter($request);

        $tasks = PokerTask::query()
            ->whereIn('poker_game_id', $team->pokerGames()->select('id'))
            ->whereNotNull('estimated_at')
            ->when($gameId !== null, fn ($query) => $query->where('poker_game_id', $gameId))
            ->when($search !== '', fn ($query) => $query->whereContains('title', $search))
            ->with([
                'game.players.user',
                'rounds' => fn ($query) => $query->whereNotNull('revealed_at')->reorder()->orderByDesc('number')->with('votes'),
            ])
            ->withCount('rounds')
            ->orderByDesc('estimated_at')
            ->orderBy('id')
            ->paginate(self::PerPage)
            ->withQueryString();

        return Inertia::render('poker/estimates', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'games' => $games->map(fn (PokerGame $game): array => ['id' => $game->id, 'title' => $game->title])->values(),
            'filters' => ['game' => $gameId, 'q' => $search],
            'tasks' => collect($tasks->items())
                ->when($search !== '', fn (SupportCollection $page) => $page->filter(fn (PokerTask $task): bool => SearchText::contains($task->title, $search)))
                ->map(fn (PokerTask $task): array => $this->presentRow($task, $user))
                ->values(),
            'pagination' => [
                'currentPage' => $tasks->currentPage(),
                'lastPage' => $tasks->lastPage(),
                'total' => $tasks->total(),
            ],
            'summary' => ['gamesCount' => $this->estimatedGamesCount($team)],
        ]);
    }

    /**
     * The games of the team that hold at least one saved estimate, whatever the filters.
     */
    private function estimatedGamesCount(Team $team): int
    {
        return PokerTask::query()
            ->whereIn('poker_game_id', $team->pokerGames()->select('id'))
            ->whereNotNull('estimated_at')
            ->distinct()
            ->count('poker_game_id');
    }

    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     ticketKey: ?string,
     *     gameId: string,
     *     gameTitle: string,
     *     estimate: ?string,
     *     roundsCount: int,
     *     estimatedAt: ?string,
     *     deck: string,
     *     voters: array<int, array{name: string, avatarUrl: string}>,
     *     votersCount: int,
     *     rounds: array<int, array<string, mixed>>,
     *     players: array<int, array{id: string, name: string}>
     * }
     */
    private function presentRow(PokerTask $task, User $user): array
    {
        $game = $task->game;
        $viewerPlayerId = $game->players->firstWhere('user_id', $user->id)?->id;
        $lastRound = $task->rounds->first();
        $lastRoundVoterIds = $lastRound?->votes->pluck('poker_player_id') ?? collect();
        $lastRoundVoters = $game->players->filter(fn (PokerPlayer $player) => $lastRoundVoterIds->contains($player->id));
        $voterIds = $task->rounds->flatMap(fn (PokerRound $round) => $round->votes->map(fn (PokerVote $vote) => $vote->poker_player_id))->unique();

        return [
            'id' => $task->id,
            'title' => $task->title,
            'ticketKey' => $task->external_source === null ? null : $task->external_key,
            'gameId' => $game->id,
            'gameTitle' => $game->title,
            'estimate' => $task->estimate,
            'roundsCount' => (int) $task->rounds_count,
            'estimatedAt' => $task->estimated_at?->toIso8601String(),
            'deck' => $game->deckLabel(),
            'voters' => $lastRound->anonymous ?? false
                ? []
                : $lastRoundVoters
                    ->map(fn (PokerPlayer $player): array => ['name' => $player->displayName(), 'avatarUrl' => $player->avatarUrl()])
                    ->values()
                    ->all(),
            'votersCount' => $lastRoundVoters->count(),
            'rounds' => $task->rounds
                ->map(fn (PokerRound $round): array => $this->presentPokerRound->handle($round, $game, $viewerPlayerId))
                ->values()
                ->all(),
            'players' => $game->players
                ->filter(fn (PokerPlayer $player) => $voterIds->contains($player->id))
                ->map(fn (PokerPlayer $player): array => ['id' => $player->id, 'name' => $player->displayName()])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, PokerGame>  $games
     */
    private function gameFilter(Request $request, Collection $games): ?string
    {
        $gameId = $request->query('game');

        if (! is_string($gameId)) {
            return null;
        }

        return $games->contains('id', $gameId) ? $gameId : null;
    }

    private function searchFilter(Request $request): string
    {
        $search = $request->query('q');

        return is_string($search) ? trim($search) : '';
    }
}
