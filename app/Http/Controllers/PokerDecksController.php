<?php

namespace App\Http\Controllers;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PokerDecksController extends Controller
{
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
        });

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
