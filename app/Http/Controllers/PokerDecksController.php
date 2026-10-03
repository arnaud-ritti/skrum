<?php

namespace App\Http\Controllers;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\PokerDeck;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use App\Support\Database\Transactions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PokerDecksController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team): Response
    {
        Gate::authorize('viewAny', [SavedPokerDeck::class, $team]);

        $user = $request->user();

        return Inertia::render('poker/decks', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'builtInDecks' => $this->builtInDecks($team),
            'savedDecks' => $this->savedDecks($user, $workspace, $team),
            'canCreate' => $user->can('create', [SavedPokerDeck::class, $team]),
            'canSetDefault' => $user->can('update', $team),
            'deckLimit' => SavedPokerDeckRules::MaxDecks,
        ]);
    }

    /**
     * @return array<int, array{
     *     key: string,
     *     name: string,
     *     cards: array<int, string>,
     *     isDefault: bool,
     *     usageCount: int
     * }>
     */
    private function builtInDecks(Team $team): array
    {
        $decks = collect(PokerDeck::cases())
            ->reject(fn (PokerDeck $deck): bool => $deck === PokerDeck::Custom)
            ->values()
            ->all();
        $defaultDeck = $team->default_saved_poker_deck_id === null
            ? ($team->default_poker_deck ?? $decks[0]->value)
            : null;

        return array_map(fn (PokerDeck $deck): array => [
            'key' => $deck->value,
            'name' => $deck->label(),
            'cards' => $deck->cards(),
            'isDefault' => $deck->value === $defaultDeck,
            'usageCount' => $team->pokerGames()->where('deck', $deck->value)->count(),
        ], $decks);
    }

    /**
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     cards: array<int, string>,
     *     scope: string,
     *     isDefault: bool,
     *     usageCount: int,
     *     canManage: bool,
     *     createdBy: string|null
     * }>
     */
    private function savedDecks(User $user, Workspace $workspace, Team $team): array
    {
        $isManager = $user->canManage($workspace);

        $decks = $team->availablePokerDecks()
            ->with('creator:id,name')
            ->withCount(['games' => fn ($query) => $query->where('team_id', $team->id)])
            ->orderBy('id')
            ->get();

        return Alphabetical::sort($decks, fn (SavedPokerDeck $deck): string => $deck->name)
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'scope' => $deck->isWorkspaceDeck() ? 'workspace' : 'team',
                'isDefault' => $deck->id === $team->default_saved_poker_deck_id,
                'usageCount' => (int) $deck->games_count,
                'canManage' => $isManager || (! $deck->isWorkspaceDeck() && $deck->created_by_user_id === $user->id),
                'createdBy' => $deck->creator?->name,
            ])
            ->values()
            ->all();
    }

    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('create', [SavedPokerDeck::class, $team]);

        $validated = $request->validate([
            'name' => ['required', ...SavedPokerDeckRules::nameRules($team)],
            'cards' => PokerDeckRules::cardListRules(),
            'cards.*' => PokerDeckRules::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($request, $team, $validated): void {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            SavedPokerDeckRules::ensureRoom($lockedTeam);

            $lockedTeam->pokerDecks()->create([
                'name' => $validated['name'],
                'cards' => $this->cards($validated),
                'created_by_user_id' => $request->user()->id,
            ]);
        }, Transactions::Attempts);

        return back();
    }

    public function update(Request $request, Workspace $workspace, Team $team, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        Gate::authorize('update', $pokerDeck);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', ...SavedPokerDeckRules::nameRules($team, $pokerDeck)],
            'cards' => ['sometimes', ...PokerDeckRules::cardListRules()],
            'cards.*' => PokerDeckRules::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ]);

        $attributes = [];

        if (array_key_exists('name', $validated)) {
            $attributes['name'] = $validated['name'];
        }

        if (array_key_exists('cards', $validated)) {
            $attributes['cards'] = $this->cards($validated);
        }

        $pokerDeck->update($attributes);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        Gate::authorize('delete', $pokerDeck);

        $pokerDeck->delete();

        return back();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int, string>
     */
    private function cards(array $validated): array
    {
        /** @var array<int, string> $cards */
        $cards = $validated['cards'];

        return PokerDeckRules::withSpecialCards(
            $cards,
            (bool) ($validated['include_unknown'] ?? true),
            (bool) ($validated['include_coffee'] ?? true),
        );
    }
}
