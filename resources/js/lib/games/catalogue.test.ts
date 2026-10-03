import { describe, expect, it } from 'vitest';
import { GameCatalogue } from './catalogue';
import { MinimumPlayers } from './turns';

describe('GameCatalogue', () => {
    it('has one entry per game of the eight', () => {
        expect(Object.keys(GameCatalogue).sort()).toEqual(
            Object.keys(MinimumPlayers).sort(),
        );
        expect(Object.keys(GameCatalogue)).toHaveLength(8);
    });

    it('takes every minimum from the Start rule, never above the maximum', () => {
        for (const [game, entry] of Object.entries(GameCatalogue)) {
            expect(entry.players.min).toBe(
                MinimumPlayers[game as keyof typeof MinimumPlayers],
            );
            expect(entry.players.min).toBeLessThanOrEqual(entry.players.max);
        }
    });

    it('gives hangman a range, Quick question a duration per person and Mood weather its anonymous note', () => {
        expect(GameCatalogue.hangman).toMatchObject({
            durationMin: 5,
            durationMax: 10,
        });
        expect(GameCatalogue.quick_question).toMatchObject({
            durationMin: 2,
            durationPerPerson: true,
        });
        expect(GameCatalogue.mood).toMatchObject({
            durationMin: 3,
            anonymous: true,
        });
    });
});
