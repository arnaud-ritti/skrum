<?php

namespace App\Http\Controllers;

use App\Actions\Poker\SavedPokerDeckRules;
use App\Http\Requests\DefaultPokerDeckUpdateRequest;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;

class TeamDefaultPokerDecksController extends Controller
{
    public function update(DefaultPokerDeckUpdateRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $savedDeckId = $request->validated('saved_deck_id');

        if ($savedDeckId !== null) {
            $savedDeck = SavedPokerDeckRules::findForTeam($team, $savedDeckId);

            $team->update([
                'default_poker_deck' => null,
                'default_saved_poker_deck_id' => $savedDeck->id,
            ]);

            return back();
        }

        $team->update([
            'default_poker_deck' => $request->validated('deck'),
            'default_saved_poker_deck_id' => null,
        ]);

        return back();
    }
}
