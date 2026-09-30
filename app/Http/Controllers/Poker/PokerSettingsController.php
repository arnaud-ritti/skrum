<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerSettingsController extends Controller
{
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            ...PokerDeckRules::rules(deckRequired: false),
            'guest_access_enabled' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($game, $player, $validated): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            if (array_key_exists('deck', $validated) && $locked->hasVotes()) {
                throw ValidationException::withMessages(['deck' => __("The deck can't change once votes exist.")]);
            }

            $locked->update($this->attributes($validated, $locked));

            (new PokerGameChanged($locked->id))->sendToOthers();
        });

        return response()->noContent();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function attributes(array $validated, PokerGame $locked): array
    {
        $attributes = Arr::only($validated, ['title', 'guest_access_enabled']);

        if (array_key_exists('deck', $validated)) {
            [$deck, $cards] = PokerDeckRules::resolve($validated);

            $attributes = [...$attributes, 'deck' => $deck, 'cards' => $cards, 'deck_name' => null];
        }

        return $attributes;
    }
}
