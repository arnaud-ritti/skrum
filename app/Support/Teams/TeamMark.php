<?php

namespace App\Support\Teams;

use App\Enums\ColumnColor;
use App\Models\Team;

class TeamMark
{
    /** The order of `resources/js/lib/mark-color.ts`: both must give one id the same colour. */
    public const array Order = [
        ColumnColor::Coral,
        ColumnColor::Lagoon,
        ColumnColor::Iris,
        ColumnColor::Moss,
        ColumnColor::Apricot,
        ColumnColor::Sky,
        ColumnColor::Plum,
        ColumnColor::Sun,
    ];

    public static function colorFor(Team $team): ColumnColor
    {
        return $team->color ?? self::derived($team->id);
    }

    public static function derived(string $id): ColumnColor
    {
        $sum = 0;

        foreach (mb_str_split($id) as $character) {
            $sum += mb_ord($character);
        }

        return self::Order[$sum % count(self::Order)];
    }
}
