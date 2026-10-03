<?php

namespace App\Support\Games;

use App\Enums\GameWordTheme;
use App\Models\GameRoom;
use Illuminate\Validation\Rule;

/**
 * The settings card of a room (spec §6.2): what the host may change, how it
 * is stored, and what a room created from now on starts with.
 */
class GameRoomSettings
{
    public const Keys = ['word_themes', 'turn_seconds', 'auto_hints', 'takes_turns', 'rounds_per_game', 'gif_votes', 'gif_authors_hidden'];

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        return [
            'word_themes' => ['sometimes', 'nullable', 'array', 'max:'.count(GameWordTheme::cases())],
            'word_themes.*' => ['string', 'distinct', Rule::enum(GameWordTheme::class)],
            'turn_seconds' => ['sometimes', 'nullable', 'integer', Rule::in(GameRoom::TurnSeconds)],
            'auto_hints' => ['sometimes', 'boolean'],
            'takes_turns' => ['sometimes', 'boolean'],
            'rounds_per_game' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.GameRoom::MaxRoundsPerGame],
            'gif_votes' => ['sometimes', 'integer', 'min:1', 'max:'.GameRoom::MaxGifVotes],
            'gif_authors_hidden' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Themes in the enum's order, so that one choice is stored one way; an
     * empty list means every word and is stored as null.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    public static function normalise(array $validated): array
    {
        if (! array_key_exists('word_themes', $validated)) {
            return $validated;
        }

        $chosen = (array) ($validated['word_themes'] ?? []);

        $themes = array_values(array_map(
            fn (GameWordTheme $theme): string => $theme->value,
            array_filter(GameWordTheme::cases(), fn (GameWordTheme $theme): bool => in_array($theme->value, $chosen, true)),
        ));

        return [...$validated, 'word_themes' => $themes === [] ? null : $themes];
    }

    /**
     * @return array{wordThemes: array<int, string>, turnSeconds: ?int, autoHints: bool, takesTurns: bool, roundsPerGame: ?int, gifVotes: int, gifAuthorsHidden: bool}
     */
    public static function present(GameRoom $room): array
    {
        return [
            'wordThemes' => array_map(fn (GameWordTheme $theme): string => $theme->value, $room->wordThemes()),
            'turnSeconds' => $room->turn_seconds,
            'autoHints' => $room->auto_hints,
            'takesTurns' => $room->takes_turns,
            'roundsPerGame' => $room->rounds_per_game,
            'gifVotes' => $room->gif_votes,
            'gifAuthorsHidden' => $room->gif_authors_hidden,
        ];
    }

    /**
     * @return array{takes_turns: true, gif_votes: int, gif_authors_hidden: true}
     */
    public static function forNewRoom(): array
    {
        return ['takes_turns' => true, 'gif_votes' => 2, 'gif_authors_hidden' => true];
    }
}
