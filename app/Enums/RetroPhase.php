<?php

namespace App\Enums;

enum RetroPhase: string
{
    case Icebreaker = 'icebreaker';
    case Writing = 'writing';
    case Grouping = 'grouping';
    case Voting = 'voting';
    case Discussing = 'discussing';
    case Actions = 'actions';
    case Roti = 'roti';
    case Completed = 'completed';

    public function isOpen(): bool
    {
        return $this !== self::Completed;
    }

    /**
     * @return array<int, self>
     */
    public static function hidingOthersCards(): array
    {
        return [self::Icebreaker, self::Writing];
    }

    public function hidesOthersCards(): bool
    {
        return in_array($this, self::hidingOthersCards(), true);
    }

    public function takesActionItems(): bool
    {
        return in_array($this, [self::Discussing, self::Actions, self::Roti], true);
    }

    public function showsTopics(): bool
    {
        return in_array($this, [self::Discussing, self::Actions], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Icebreaker => __('Icebreaker'),
            self::Writing => __('Writing'),
            self::Grouping => __('Grouping'),
            self::Voting => __('Voting'),
            self::Discussing => __('Discussing'),
            self::Actions => __('Actions'),
            self::Roti => __('ROTI'),
            self::Completed => __('Completed'),
        };
    }
}
