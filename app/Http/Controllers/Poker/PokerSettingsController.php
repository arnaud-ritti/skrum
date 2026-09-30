<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerGameChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
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
            'anonymous_votes' => ['sometimes', 'boolean'],
            'cursors_enabled' => ['sometimes', 'boolean'],
            'reactions_enabled' => ['sometimes', 'boolean'],
        ]);

        $turnsAnonymityOn = array_key_exists('anonymous_votes', $validated) && (bool) $validated['anonymous_votes'];

        DB::transaction(function () use ($game, $player, $validated, $turnsAnonymityOn): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            if (array_key_exists('deck', $validated) && $locked->hasVotes()) {
                throw ValidationException::withMessages(['deck' => __("The deck can't change once votes exist.")]);
            }

            $locked->update($this->attributes($validated, $locked));

            if ($turnsAnonymityOn) {
                $this->anonymizeOpenRounds($locked);
            }

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
        $attributes = Arr::only($validated, ['title', 'guest_access_enabled', 'anonymous_votes', 'cursors_enabled', 'reactions_enabled']);

        if (array_key_exists('deck', $validated)) {
            [$deck, $cards] = PokerDeckRules::resolve($validated);

            $attributes = [...$attributes, 'deck' => $deck, 'cards' => $cards, 'deck_name' => null];
        }

        return $attributes;
    }

    /**
     * More privacy is always safe, so open rounds follow the switch at once;
     * turning it off only applies to rounds created afterwards.
     */
    private function anonymizeOpenRounds(PokerGame $locked): void
    {
        PokerRound::query()
            ->whereIn('poker_task_id', PokerTask::query()->where('poker_game_id', $locked->id)->select('id'))
            ->whereNull('revealed_at')
            ->update(['anonymous' => true]);
    }
}
