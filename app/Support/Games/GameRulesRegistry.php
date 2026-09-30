<?php

namespace App\Support\Games;

use App\Enums\GameKind;
use App\Models\GameRoom;
use LogicException;

class GameRulesRegistry
{
    /** @var array<string, GameRules> */
    private array $rules = [];

    /**
     * @param  array<int, GameRules>  $rules
     */
    public function __construct(array $rules)
    {
        foreach ($rules as $rule) {
            $this->rules[$rule->kind()->value] = $rule;
        }
    }

    public function find(GameKind $kind): ?GameRules
    {
        return $this->rules[$kind->value] ?? null;
    }

    public function for(GameKind $kind): GameRules
    {
        return $this->find($kind) ?? throw new LogicException("No rules are registered for [{$kind->value}].");
    }

    public function isAvailable(GameKind $kind, GameRoom $room): bool
    {
        return $this->find($kind)?->isAvailable($room) ?? false;
    }

    /**
     * @return array<int, array{value: string, label: string, available: bool}>
     */
    public function options(GameRoom $room): array
    {
        return array_map(fn (GameKind $kind): array => [
            'value' => $kind->value,
            'label' => $kind->label(),
            'available' => $this->isAvailable($kind, $room),
        ], GameKind::cases());
    }
}
