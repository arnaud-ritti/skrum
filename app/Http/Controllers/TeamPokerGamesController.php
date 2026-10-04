<?php

namespace App\Http\Controllers;

use App\Actions\Integrations\FetchPokerImport;
use App\Actions\Integrations\PokerImportBatch;
use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\PokerGameSettingsRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class TeamPokerGamesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreatePokerGame $createPokerGame, FetchPokerImport $fetchPokerImport): RedirectResponse
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
            'guest_access_enabled' => ['sometimes', 'boolean'],
            'spectator' => ['sometimes', 'boolean'],
            'tasks' => ['sometimes', 'array', 'max:50'],
            'tasks.*' => ['required', 'string', 'max:200'],
            'import_source' => ['required_with:import_ids', 'string', Rule::in(['jira', 'linear', 'jira_dc', 'github'])],
            'import_ids' => ['sometimes', 'array', 'min:1', 'max:100', 'prohibits:tasks'],
            'import_ids.*' => ['required', 'string', 'max:100', 'distinct'],
            ...PokerGameSettingsRules::rules($team),
        ]);

        $savedDeck = null;

        if ($usesSavedDeck) {
            $savedDeck = SavedPokerDeckRules::findForTeam($team, (string) $validated['saved_deck_id']);
            [$deck, $cards, $deckName] = [PokerDeck::Custom, $savedDeck->cards, $savedDeck->name];
        } else {
            [$deck, $cards] = PokerDeckRules::resolve($validated);
            $deckName = $validated['save_deck_as'] ?? null;
        }

        $import = isset($validated['import_ids'])
            ? $fetchPokerImport->handle($team, (string) $validated['import_source'], array_values($validated['import_ids']))
            : null;

        $game = $createPokerGame->handle($team, $request->user(), new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            deckName: $deckName,
            anonymousVotes: (bool) ($validated['anonymous_votes'] ?? false),
            autoReveal: (bool) ($validated['auto_reveal'] ?? false),
            saveDeckAs: $validated['save_deck_as'] ?? null,
            savedDeckId: $savedDeck?->id,
            guestAccessEnabled: (bool) ($validated['guest_access_enabled'] ?? false),
            spectator: (bool) ($validated['spectator'] ?? false),
            tasks: array_values($validated['tasks'] ?? []),
            revoteAfterReveal: (bool) ($validated['revote_after_reveal'] ?? false),
            taskTimerSeconds: isset($validated['task_timer_seconds']) ? (int) $validated['task_timer_seconds'] : null,
            writesEstimates: (bool) ($validated['writes_estimates'] ?? true),
            estimateFieldId: $validated['estimate_field_id'] ?? null,
            import: $import,
        ));

        if ($import !== null) {
            $this->flashSkippedTickets($game, $import);
        }

        return to_route('poker.show', $game);
    }

    private function flashSkippedTickets(PokerGame $game, PokerImportBatch $import): void
    {
        $imported = $game->tasks()->count();
        $skipped = count($import->externalIds) - $imported;

        if ($skipped === 0) {
            return;
        }

        Inertia::flash('toast', ['type' => 'info', 'message' => __(':imported, :skipped.', [
            'imported' => trans_choice(':count ticket imported|:count tickets imported', $imported),
            'skipped' => trans_choice(':count skipped|:count skipped', $skipped),
        ])]);
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
