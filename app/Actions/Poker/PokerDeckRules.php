<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use Closure;
use Illuminate\Validation\Rule;

class PokerDeckRules
{
    public const MinCards = 2;

    public const MaxCards = 20;

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(bool $deckRequired = true): array
    {
        return [
            'deck' => [$deckRequired ? 'required' : 'sometimes', Rule::enum(PokerDeck::class)],
            'custom_cards' => ['exclude_unless:deck,'.PokerDeck::Custom->value, ...self::cardListRules()],
            'custom_cards.*' => self::cardRules(),
            'include_unknown' => ['sometimes', 'boolean'],
            'include_coffee' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Rules for a list of cards typed by a person, before `?` and `☕` are
     * appended by the checkboxes.
     *
     * @return array<int, mixed>
     */
    public static function cardListRules(): array
    {
        return [
            'required',
            'array',
            function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_array($value)) {
                    return;
                }

                if (count($value) < self::MinCards || count($value) > self::MaxCards) {
                    $fail(__('Give between 2 and 20 cards.'));

                    return;
                }

                $cards = array_map(fn (mixed $card): string => is_string($card) ? trim($card) : '', array_values($value));

                if (count(array_unique($cards)) !== count($cards)) {
                    $fail(__('Each card can appear only once.'));

                    return;
                }

                $estimates = array_filter($cards, fn (string $card): bool => $card !== '' && ! PokerDeck::isSpecial($card));

                if ($estimates === []) {
                    $fail(__('Add at least one card that can be an estimate.'));
                }
            },
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function cardRules(): array
    {
        return ['required', 'string', 'max:8'];
    }

    /**
     * @param  array<int, string>  $cards
     * @return array<int, string>
     */
    public static function withSpecialCards(array $cards, bool $includeUnknown, bool $includeCoffee): array
    {
        $cards = array_values(array_map('trim', $cards));

        if ($includeUnknown && ! in_array(PokerDeck::UnknownCard, $cards, true)) {
            $cards[] = PokerDeck::UnknownCard;
        }

        if ($includeCoffee && ! in_array(PokerDeck::CoffeeCard, $cards, true)) {
            $cards[] = PokerDeck::CoffeeCard;
        }

        return $cards;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{0: PokerDeck, 1: array<int, string>}
     */
    public static function resolve(array $validated): array
    {
        $deck = PokerDeck::from((string) $validated['deck']);

        if ($deck !== PokerDeck::Custom) {
            return [$deck, $deck->cards()];
        }

        /** @var array<int, string> $customCards */
        $customCards = $validated['custom_cards'];

        return [$deck, self::withSpecialCards(
            $customCards,
            (bool) ($validated['include_unknown'] ?? true),
            (bool) ($validated['include_coffee'] ?? true),
        )];
    }
}
