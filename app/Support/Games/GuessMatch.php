<?php

namespace App\Support\Games;

use App\Enums\GuessResult;

/**
 * Spec §4: both sides are folded to ASCII, lowercased and stripped of
 * hyphens, apostrophes and extra spaces; a guess one letter away from a
 * short word, or up to two from a longer one, is "very close".
 */
class GuessMatch
{
    private const int ShortWordLetters = 4;

    public static function check(string $word, string $guess): GuessResult
    {
        $expected = GameWord::normalize($word);
        $given = GameWord::normalize($guess);

        if ($given === '') {
            return GuessResult::Wrong;
        }

        if ($given === $expected) {
            return GuessResult::Correct;
        }

        $letters = strlen(str_replace(' ', '', $expected));
        $maxDistance = $letters <= self::ShortWordLetters ? 1 : 2;

        return levenshtein($given, $expected) <= $maxDistance ? GuessResult::Near : GuessResult::Wrong;
    }
}
