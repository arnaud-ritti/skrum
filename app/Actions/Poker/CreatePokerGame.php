<?php

namespace App\Actions\Poker;

use App\Models\PokerGame;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreatePokerGame
{
    public function handle(Team $team, User $creator, NewPokerGame $new): PokerGame
    {
        return DB::transaction(function () use ($team, $creator, $new): PokerGame {
            if ($new->saveDeckAs !== null) {
                $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

                SavedPokerDeckRules::ensureRoom($lockedTeam);

                $lockedTeam->pokerDecks()->create([
                    'name' => $new->saveDeckAs,
                    'cards' => $new->cards,
                    'created_by_user_id' => $creator->id,
                ]);
            }

            $game = $team->pokerGames()->create([
                'title' => $new->title,
                'deck' => $new->deck,
                'cards' => $new->cards,
                'deck_name' => $new->deckName,
                'anonymous_votes' => $new->anonymousVotes,
                'auto_reveal' => $new->autoReveal,
                'guest_token' => Str::random(40),
            ]);

            $player = $game->players()->create(['user_id' => $creator->id]);

            $game->update(['facilitator_player_id' => $player->id]);

            return $game;
        });
    }
}
