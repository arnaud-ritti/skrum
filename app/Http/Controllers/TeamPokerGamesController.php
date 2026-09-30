<?php

namespace App\Http\Controllers;

use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\PokerDeckRules;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamPokerGamesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, CreatePokerGame $createPokerGame): RedirectResponse
    {
        Gate::authorize('createPokerGame', $team);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            ...PokerDeckRules::rules(),
            'anonymous_votes' => ['sometimes', 'boolean'],
            'auto_reveal' => ['sometimes', 'boolean'],
        ]);

        [$deck, $cards] = PokerDeckRules::resolve($validated);

        $game = $createPokerGame->handle($team, $request->user(), new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            anonymousVotes: (bool) ($validated['anonymous_votes'] ?? false),
            autoReveal: (bool) ($validated['auto_reveal'] ?? false),
        ));

        return to_route('poker.show', $game);
    }
}
