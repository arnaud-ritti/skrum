<?php

namespace App\Actions\Poker;

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerRound;
use App\Models\PokerVote;

class PokerResult
{
    private const float Epsilon = 1e-9;

    /**
     * @return array{
     *     average: ?float,
     *     distribution: array<int, array{value: string, count: int}>,
     *     mode: array<int, string>,
     *     consensus: bool,
     *     nearestCard: ?string,
     *     median: ?float,
     *     spread: ?array{min: float, max: float},
     *     agreement: ?float,
     *     outliers: array{low: list<string>, high: list<string>}
     * }
     */
    public static function for(PokerRound $round, PokerGame $game): array
    {
        return self::compute(
            $game->cards,
            $round->votes->map(fn (PokerVote $vote): string => $vote->value)->all(),
            $round->anonymous ? [] : $round->votes->pluck('value', 'poker_player_id')->all(),
        );
    }

    /**
     * @param  array<int, string>  $deckCards
     * @param  array<int, string>  $values
     * @param  array<string, string>  $valuesByPlayer  empty on an anonymous round, so that nobody is named
     * @return array{
     *     average: ?float,
     *     distribution: array<int, array{value: string, count: int}>,
     *     mode: array<int, string>,
     *     consensus: bool,
     *     nearestCard: ?string,
     *     median: ?float,
     *     spread: ?array{min: float, max: float},
     *     agreement: ?float,
     *     outliers: array{low: list<string>, high: list<string>}
     * }
     */
    public static function compute(array $deckCards, array $values, array $valuesByPlayer = []): array
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
                'median' => null,
                'spread' => null,
                'agreement' => null,
                'outliers' => ['low' => [], 'high' => []],
            ];
        }

        $average = PokerDeck::isNumericDeck($deckCards) ? self::average($countable) : null;
        $mode = self::mode($countable);
        $numericVotes = self::numericVotes($countable);

        return [
            'average' => $average,
            'distribution' => $distribution,
            'mode' => $mode,
            'consensus' => count($countable) === 1,
            'nearestCard' => $average === null ? null : self::nearestCard($deckCards, $average),
            'median' => self::median($numericVotes),
            'spread' => $numericVotes === [] ? null : ['min' => min($numericVotes), 'max' => max($numericVotes)],
            'agreement' => self::agreement($countable),
            'outliers' => self::outliers($valuesByPlayer, $mode, $numericVotes),
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

    /**
     * @param  array<int, array{value: string, count: int}>  $countable
     * @return list<float>
     */
    private static function numericVotes(array $countable): array
    {
        $numericVotes = [];

        foreach ($countable as $entry) {
            $value = PokerDeck::numericValue($entry['value']);

            if ($value === null) {
                continue;
            }

            array_push($numericVotes, ...array_fill(0, $entry['count'], $value));
        }

        sort($numericVotes);

        return $numericVotes;
    }

    /**
     * @param  list<float>  $sortedVotes
     */
    private static function median(array $sortedVotes): ?float
    {
        $count = count($sortedVotes);

        if ($count === 0) {
            return null;
        }

        $middle = intdiv($count, 2);

        if ($count % 2 === 1) {
            return $sortedVotes[$middle];
        }

        return ($sortedVotes[$middle - 1] + $sortedVotes[$middle]) / 2;
    }

    /**
     * @param  non-empty-list<array{value: string, count: int}>  $countable
     */
    private static function agreement(array $countable): float
    {
        $highest = max(array_column($countable, 'count'));

        return round($highest / array_sum(array_column($countable, 'count')), 2);
    }

    /**
     * @param  array<string, string>  $valuesByPlayer
     * @param  array<int, string>  $mode
     * @param  list<float>  $sortedVotes
     * @return array{low: list<string>, high: list<string>}
     */
    private static function outliers(array $valuesByPlayer, array $mode, array $sortedVotes): array
    {
        $outliers = ['low' => [], 'high' => []];

        if ($valuesByPlayer === [] || $sortedVotes === []) {
            return $outliers;
        }

        $modeValues = array_map(PokerDeck::numericValue(...), $mode);
        $ends = ['low' => $sortedVotes[0], 'high' => $sortedVotes[count($sortedVotes) - 1]];

        foreach ($ends as $side => $end) {
            if (in_array($end, $modeValues, true)) {
                continue;
            }

            foreach ($valuesByPlayer as $playerId => $value) {
                if (PokerDeck::numericValue($value) === $end) {
                    $outliers[$side][] = (string) $playerId;
                }
            }
        }

        return $outliers;
    }
}
