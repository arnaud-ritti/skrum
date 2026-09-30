<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Support\Games\GameRulesRegistry;
use App\Support\Gifs\GifCatalog;
use Closure;

/**
 * The games a retro may start its icebreaker with (spec §2): every game
 * with rules, "Sprint in one GIF" only when a GIF provider is configured.
 * Whether the retro allows GIFs is checked when a round starts.
 */
class IcebreakerGameOptions
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private GifCatalog $gifCatalog,
    ) {}

    public function allows(GameKind $game): bool
    {
        if ($this->gameRulesRegistry->find($game) === null) {
            return false;
        }

        return $game !== GameKind::SprintGif || $this->gifCatalog->isAvailable();
    }

    /**
     * @return array<int, array{value: string, label: string, available: bool}>
     */
    public function options(): array
    {
        return array_map(fn (GameKind $game): array => [
            'value' => $game->value,
            'label' => $game->label(),
            'available' => $this->allows($game),
        ], GameKind::cases());
    }

    public function rule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $game = is_string($value) ? GameKind::tryFrom($value) : null;

            if ($game === null || $this->allows($game)) {
                return;
            }

            $fail(__('This game is not available.'));
        };
    }
}
