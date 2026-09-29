<?php

namespace App\Enums;

enum RetroPhase: string
{
    case Writing = 'writing';
    case Grouping = 'grouping';
    case Voting = 'voting';
    case Discussing = 'discussing';
    case Completed = 'completed';

    public function next(): ?self
    {
        $cases = self::cases();
        $index = array_search($this, $cases, true);

        return $cases[$index + 1] ?? null;
    }

    public function previous(): ?self
    {
        $cases = self::cases();
        $index = array_search($this, $cases, true);

        return $cases[$index - 1] ?? null;
    }

    public function isAdjacentTo(self $other): bool
    {
        return $this->next() === $other || $this->previous() === $other;
    }

    public function label(): string
    {
        return match ($this) {
            self::Writing => __('Writing'),
            self::Grouping => __('Grouping'),
            self::Voting => __('Voting'),
            self::Discussing => __('Discussing'),
            self::Completed => __('Completed'),
        };
    }
}
