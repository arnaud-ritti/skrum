<?php

namespace App\Actions\Whiteboards;

use OverflowException;

/**
 * The keys the canvas itself gives the elements of a new scene, in stacking
 * order: `a0` … `az`, then `b00` … `bzz`, then `c000` …
 */
class GenerateFractionalIndexes
{
    private const string Digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    private const string HeadLetters = 'abcdefghijklmnopqrstuvwxyz';

    private const int Base = 62;

    /**
     * @return list<string>
     */
    public function handle(int $count): array
    {
        $indexes = [];

        for ($position = 0; $position < $count; $position++) {
            $indexes[] = $this->at($position);
        }

        return $indexes;
    }

    private function at(int $position): string
    {
        $width = 1;

        while ($position >= self::Base ** $width) {
            $position -= self::Base ** $width;
            $width++;
        }

        throw_if($width > strlen(self::HeadLetters), OverflowException::class, "No fractional index past the width of the head letter z: position {$position}.");

        $digits = '';

        for ($place = 0; $place < $width; $place++) {
            $digits = self::Digits[$position % self::Base].$digits;
            $position = intdiv($position, self::Base);
        }

        return self::HeadLetters[$width - 1].$digits;
    }
}
