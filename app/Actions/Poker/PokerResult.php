<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerVote;

class PokerResult
{
    private const Epsilon = 1e-9;

    /**
     * @return array{
     *     average: ?float,
     *     distribution: array<int, array{value: string, count: int}>,
     *     mode: array<int, string>,
     *     consensus: bool,
     *     nearestCard: ?string
     * }
     */
    public static function for(PokerRound $round, PokerGame $game): array
    {
        return self::compute($game->cards, $round->votes->map(fn (PokerVote $vote): string => $vote->value)->all());
    }

    /**
     * @param  array<int, string>  $deckCards
     * @param  array<int, string>  $values
     * @return array{
     *     average: ?float,
     *     distribution: array<int, array{value: string, count: int}>,
     *     mode: array<int, string>,
     *     consensus: bool,
     *     nearestCard: ?string
     * }
     */
    public static function compute(array $deckCards, array $values): array
    {
        $distribution = self::distribution($deckCards, $values);
        $countable = array_values(array_filter($distribution, fn (array $entry): bool => ! PokerDeck::isSpecial($entry['value'])));

        if ($countable === []) {
            return [
                'average' => null,
                'distribution' => $distribution,
                'mode' => [],
                'consensus' => false,
                'nearestCard' => null,
            ];
        }

        $average = PokerDeck::isNumericDeck($deckCards) ? self::average($countable) : null;

        return [
            'average' => $average,
            'distribution' => $distribution,
            'mode' => self::mode($countable),
            'consensus' => count($countable) === 1,
            'nearestCard' => $average === null ? null : self::nearestCard($deckCards, $average),
        ];
    }

    /**
     * @param  array<int, string>  $deckCards
     * @param  array<int, string>  $values
     * @return array<int, array{value: string, count: int}>
     */
    private static function distribution(array $deckCards, array $values): array
    {
        $distribution = [];

        foreach ($deckCards as $card) {
            $count = count(array_filter($values, fn (string $value): bool => $value === $card));

            if ($count === 0) {
                continue;
            }

            $distribution[] = ['value' => $card, 'count' => $count];
        }

        return $distribution;
    }

    /**
     * @param  array<int, array{value: string, count: int}>  $countable
     */
    private static function average(array $countable): float
    {
        $sum = 0.0;
        $votes = 0;

        foreach ($countable as $entry) {
            $sum += (float) PokerDeck::numericValue($entry['value']) * $entry['count'];
            $votes += $entry['count'];
        }

        return round($sum / $votes, 1);
    }

    /**
     * @param  array<int, array{value: string, count: int}>  $countable
     * @return array<int, string>
     */
    private static function mode(array $countable): array
    {
        $highest = max(0, ...array_column($countable, 'count'));

        return array_values(array_map(
            fn (array $entry): string => $entry['value'],
            array_filter($countable, fn (array $entry): bool => $entry['count'] === $highest),
        ));
    }

    /**
     * @param  array<int, string>  $deckCards
     */
    private static function nearestCard(array $deckCards, float $average): ?string
    {
        $nearest = null;
        $nearestValue = 0.0;
        $nearestDistance = INF;

        foreach ($deckCards as $card) {
            $value = PokerDeck::numericValue($card);

            if ($value === null) {
                continue;
            }

            $distance = abs($value - $average);
            $isCloser = $distance < $nearestDistance - self::Epsilon;
            $isHigherTie = abs($distance - $nearestDistance) <= self::Epsilon && $value > $nearestValue;

            if (! $isCloser && ! $isHigherTie) {
                continue;
            }

            $nearest = $card;
            $nearestValue = $value;
            $nearestDistance = $distance;
        }

        return $nearest;
    }
}
