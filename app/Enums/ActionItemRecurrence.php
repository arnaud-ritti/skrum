<?php

namespace App\Enums;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

enum ActionItemRecurrence: string
{
    case Weekly = 'weekly';
    case EveryTwoWeeks = 'every_two_weeks';
    case Monthly = 'monthly';

    /**
     * Monthly adds one calendar month, clamped to the last day of the
     * target month (31 January → 28 February).
     */
    public function advance(CarbonInterface $date): CarbonImmutable
    {
        $date = CarbonImmutable::instance($date);

        return match ($this) {
            self::Weekly => $date->addWeek(),
            self::EveryTwoWeeks => $date->addWeeks(2),
            self::Monthly => $date->addMonthNoOverflow(),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Weekly => __('Repeats weekly'),
            self::EveryTwoWeeks => __('Repeats every 2 weeks'),
            self::Monthly => __('Repeats monthly'),
        };
    }
}
