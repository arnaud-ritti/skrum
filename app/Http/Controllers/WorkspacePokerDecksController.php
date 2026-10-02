<?php

namespace App\Http\Controllers;

use App\Actions\Poker\SavedPokerDeckRules;
use App\Http\Requests\WorkspacePokerDeckRequest;
use App\Models\SavedPokerDeck;
use App\Models\Workspace;
use App\Support\Database\Transactions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class WorkspacePokerDecksController extends Controller
{
    public function store(WorkspacePokerDeckRequest $request, Workspace $workspace): RedirectResponse
    {
        DB::transaction(function () use ($request, $workspace): void {
            $lockedWorkspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();

            SavedPokerDeckRules::ensureRoomInWorkspace($lockedWorkspace);

            $lockedWorkspace->pokerDecks()->create([
                'name' => $request->validated('name'),
                'cards' => $request->deckCards(),
                'created_by_user_id' => $request->user()->id,
            ]);
        }, Transactions::Attempts);

        return back();
    }

    public function update(WorkspacePokerDeckRequest $request, Workspace $workspace, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        $attributes = [];

        if ($request->has('name')) {
            $attributes['name'] = $request->validated('name');
        }

        if ($request->has('cards')) {
            $attributes['cards'] = $request->deckCards();
        }

        $pokerDeck->update($attributes);

        return back();
    }

    public function destroy(Workspace $workspace, SavedPokerDeck $pokerDeck): RedirectResponse
    {
        Gate::authorize('delete', $pokerDeck);

        $pokerDeck->delete();

        return back();
    }
}
