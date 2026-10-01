<?php

namespace App\Enums;

/**
 * The automatic events a generic webhook can subscribe to (spec 8 §4.7).
 */
enum WebhookEvent: string
{
    case RetroCompleted = 'retro.completed';
    case ActionItemCreated = 'action_item.created';
    case ActionItemCompleted = 'action_item.completed';
    case ActionItemReopened = 'action_item.reopened';
    case PokerTaskEstimated = 'poker.task.estimated';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(fn (self $event): string => $event->value, self::cases());
    }

    /**
     * Keeps known names once, in catalogue order.
     *
     * @param  array<array-key, mixed>  $names
     * @return array<int, string>
     */
    public static function normalize(array $names): array
    {
        return array_values(array_filter(self::values(), fn (string $name): bool => in_array($name, $names, true)));
    }

    /**
     * @return array<int, array{name: string, description: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $event): array => [
            'name' => $event->value,
            'description' => $event->description(),
        ], self::cases());
    }

    public function description(): string
    {
        return match ($this) {
            self::RetroCompleted => __('A retrospective is completed, with its results recap.'),
            self::ActionItemCreated => __('An action item is created.'),
            self::ActionItemCompleted => __('An action item is completed, in skrum or in a linked tracker.'),
            self::ActionItemReopened => __('An action item is reopened.'),
            self::PokerTaskEstimated => __('A planning poker task gets its final estimate.'),
        };
    }
}
