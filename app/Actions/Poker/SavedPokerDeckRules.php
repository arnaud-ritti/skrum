<?php

namespace App\Actions\Poker;

use App\Models\SavedPokerDeck;
use App\Models\Team;
use Closure;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SavedPokerDeckRules
{
    public const MaxDecks = 30;

    /**
     * Callers prepend `required`, `sometimes` or `nullable`.
     *
     * @return array<int, mixed>
     */
    public static function nameRules(Team $team, ?SavedPokerDeck $ignore = null): array
    {
        return [
            'string',
            'max:40',
            function (string $attribute, mixed $value, Closure $fail) use ($team, $ignore): void {
                if (! is_string($value)) {
                    return;
                }

                $isTaken = $team->pokerDecks()
                    ->whereRaw('lower(name) = ?', [mb_strtolower(trim($value))])
                    ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore?->id))
                    ->exists();

                if ($isTaken) {
                    $fail(__('A deck with this name already exists.'));
                }
            },
        ];
    }

    /**
     * Call with the team row locked, inside the transaction that creates the deck.
     */
    public static function ensureRoom(Team $lockedTeam, string $attribute = 'name'): void
    {
        if ($lockedTeam->pokerDecks()->count() < self::MaxDecks) {
            return;
        }

        throw ValidationException::withMessages([$attribute => __('This team already has 30 saved decks.')]);
    }

    public static function findForTeam(Team $team, string $id, string $attribute = 'saved_deck_id'): SavedPokerDeck
    {
        $deck = Str::isUuid($id) ? $team->pokerDecks()->whereKey($id)->first() : null;

        if ($deck === null) {
            throw ValidationException::withMessages([$attribute => __('Choose a saved deck of this team.')]);
        }

        return $deck;
    }

    /**
     * A saved deck replaces custom cards, it never combines with them.
     *
     * @param  array<string, mixed>  $input
     */
    public static function ensureExclusive(array $input): void
    {
        if (! filled($input['saved_deck_id'] ?? null) || ! array_key_exists('custom_cards', $input)) {
            return;
        }

        throw ValidationException::withMessages(['saved_deck_id' => __('Choose either a saved deck or custom cards.')]);
    }
}
