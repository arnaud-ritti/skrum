<?php

namespace App\Http\Controllers;

use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\PokerDeck;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TeamPokerGamesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreatePokerGame $createPokerGame): RedirectResponse
    {
        Gate::authorize('createPokerGame', $team);

        SavedPokerDeckRules::ensureExclusive($request->all());
        $this->ensureSavableDeck($request);

        $usesSavedDeck = $request->filled('saved_deck_id');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            ...($usesSavedDeck
                ? ['deck' => ['required', Rule::in([PokerDeck::Custom->value])], 'saved_deck_id' => ['required', 'string']]
                : PokerDeckRules::rules()),
            'save_deck_as' => ['nullable', ...SavedPokerDeckRules::nameRules($team)],
            'anonymous_votes' => ['sometimes', 'boolean'],
            'auto_reveal' => ['sometimes', 'boolean'],
        ]);

        $savedDeck = null;

        if ($usesSavedDeck) {
            $savedDeck = SavedPokerDeckRules::findForTeam($team, (string) $validated['saved_deck_id']);
            [$deck, $cards, $deckName] = [PokerDeck::Custom, $savedDeck->cards, $savedDeck->name];
        } else {
            [$deck, $cards] = PokerDeckRules::resolve($validated);
            $deckName = $validated['save_deck_as'] ?? null;
        }

        $game = $createPokerGame->handle($team, $request->user(), new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            deckName: $deckName,
            anonymousVotes: (bool) ($validated['anonymous_votes'] ?? false),
            autoReveal: (bool) ($validated['auto_reveal'] ?? false),
            saveDeckAs: $validated['save_deck_as'] ?? null,
            savedDeckId: $savedDeck?->id,
        ));

        return to_route('poker.show', $game);
    }

    /**
     * Only cards typed for this game can become a new saved deck.
     */
    private function ensureSavableDeck(Request $request): void
    {
        if (! $request->filled('save_deck_as')) {
            return;
        }

        if ($request->input('deck') === PokerDeck::Custom->value && ! $request->filled('saved_deck_id')) {
            return;
        }

        throw ValidationException::withMessages(['save_deck_as' => __('Save only custom cards as a deck.')]);
    }
}
