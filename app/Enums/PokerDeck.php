<?php

namespace App\Enums;

enum PokerDeck: string
{
    case Fibonacci = 'fibonacci';
    case ModifiedFibonacci = 'modified_fibonacci';
    case Tshirt = 'tshirt';
    case PowersOfTwo = 'powers_of_two';
    case Custom = 'custom';

    public const UnknownCard = '?';

    public const CoffeeCard = '☕';

    /**
     * @return array<int, string>
     */
    public function cards(): array
    {
        return match ($this) {
            self::Fibonacci => ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', self::UnknownCard, self::CoffeeCard],
            self::ModifiedFibonacci => ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', self::UnknownCard, self::CoffeeCard],
            self::Tshirt => ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', self::UnknownCard, self::CoffeeCard],
            self::PowersOfTwo => ['0', '1', '2', '4', '8', '16', '32', '64', self::UnknownCard, self::CoffeeCard],
            self::Custom => [],
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Fibonacci => __('Fibonacci'),
            self::ModifiedFibonacci => __('Modified Fibonacci'),
            self::Tshirt => __('T-shirt sizes'),
            self::PowersOfTwo => __('Powers of 2'),
            self::Custom => __('Custom'),
        };
    }

    public static function numericValue(string $card): ?float
    {
        if ($card === '½') {
            return 0.5;
        }

        if (preg_match('/^\d+(\.\d+)?$/', $card) !== 1) {
            return null;
        }

        return (float) $card;
    }

    public static function isSpecial(string $card): bool
    {
        return $card === self::UnknownCard || $card === self::CoffeeCard;
    }

    /**
     * @param  array<int, string>  $cards
     */
    public static function isNumericDeck(array $cards): bool
    {
        foreach ($cards as $card) {
            if (self::isSpecial($card)) {
                continue;
            }

            if (self::numericValue($card) === null) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     label: string,
     *     cards: array<int, string>
     * }>
     */
    public static function options(): array
    {
        return array_map(fn (self $deck): array => [
            'value' => $deck->value,
            'label' => $deck->label(),
            'cards' => $deck->cards(),
        ], [self::Fibonacci, self::ModifiedFibonacci, self::Tshirt, self::PowersOfTwo, self::Custom]);
    }
}
