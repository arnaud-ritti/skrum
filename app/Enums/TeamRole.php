<?php

namespace App\Enums;

enum TeamRole: string
{
    case Owner = 'owner';
    case Facilitator = 'facilitator';
    case Member = 'member';
    case Observer = 'observer';

    public function label(): string
    {
        return match ($this) {
            self::Owner => __('Owner'),
            self::Facilitator => __('Facilitator'),
            self::Member => __('Member'),
            self::Observer => __('Observer'),
        };
    }

    public function managesTeam(): bool
    {
        return $this === self::Owner;
    }

    public function managesRituals(): bool
    {
        return $this === self::Owner || $this === self::Facilitator;
    }

    public function contributes(): bool
    {
        return $this !== self::Observer;
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $role): array => ['value' => $role->value, 'label' => $role->label()], self::cases());
    }
}
