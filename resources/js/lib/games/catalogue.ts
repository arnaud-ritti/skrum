import { MinimumPlayers } from './turns';
import type { GameKind } from './types';

export type GameCatalogueEntry = {
    durationMin: number;
    durationMax?: number;
    /** "2 min / person": the duration is per speaker (Quick question). */
    durationPerPerson?: boolean;
    /** "3 min · anonymous" (Mood weather). */
    anonymous?: boolean;
    players: { min: number; max: number };
};

/**
 * Spec §9.1 (owner's answer P27-04): static per game. The minimum is the
 * Start rule, the maximum the IcebreakerGameCard mockup's where it has one.
 */
export const GameCatalogue: Record<GameKind, GameCatalogueEntry> = {
    hangman: {
        durationMin: 5,
        durationMax: 10,
        players: { min: MinimumPlayers.hangman, max: 30 },
    },
    draw: { durationMin: 10, players: { min: MinimumPlayers.draw, max: 12 } },
    decoded: {
        durationMin: 5,
        players: { min: MinimumPlayers.decoded, max: 30 },
    },
    gif: { durationMin: 5, players: { min: MinimumPlayers.gif, max: 30 } },
    two_truths: {
        durationMin: 10,
        players: { min: MinimumPlayers.two_truths, max: 15 },
    },
    mood: {
        durationMin: 3,
        anonymous: true,
        players: { min: MinimumPlayers.mood, max: 30 },
    },
    guess_who: {
        durationMin: 8,
        players: { min: MinimumPlayers.guess_who, max: 15 },
    },
    quick_question: {
        durationMin: 2,
        durationPerPerson: true,
        players: { min: MinimumPlayers.quick_question, max: 12 },
    },
};
