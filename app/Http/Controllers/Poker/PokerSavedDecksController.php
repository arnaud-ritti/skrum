<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\SavedPokerDeck;
use App\Support\Alphabetical;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PokerSavedDecksController extends Controller
{
    /**
     * Facilitator only: guests never facilitate, so they never see saved decks.
     */
    public function index(Request $request, PokerGame $game): JsonResponse
    {
        PokerGuard::facilitator($game, PokerPlayer::current($request));

        return response()->json(Alphabetical::sort($game->team->availablePokerDecks()->get(), fn (SavedPokerDeck $deck): string => $deck->name)
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'scope' => $deck->isWorkspaceDeck() ? 'workspace' : 'team',
            ])
            ->values());
    }
}
