import { describe, expect, it } from 'vitest';
import {
    StandardDurations,
    choiceOf,
    customStart,
    durationsFor,
    offerFor,
    summary,
    toPayload,
} from './phase-durations';

const label = (phase: string) => phase[0].toUpperCase() + phase.slice(1);

describe('choiceOf', () => {
    it('reads no timer, the standard set and anything else as custom', () => {
        expect(choiceOf(null)).toBe('none');
        expect(choiceOf({})).toBe('none');
        expect(choiceOf({ ...StandardDurations })).toBe('standard');
        expect(choiceOf({ ...StandardDurations, voting: 4 })).toBe('custom');
        expect(choiceOf({ writing: 7 })).toBe('custom');
    });
});

describe('toPayload', () => {
    it('drops the phases without minutes, and is null when none is left', () => {
        expect(toPayload({ writing: 10, voting: 0, grouping: 0 })).toEqual({
            writing: 10,
        });
        expect(toPayload({ writing: 0 })).toBeNull();
        expect(toPayload({})).toBeNull();
    });
});

describe('durationsFor', () => {
    it('gives each choice the minutes it sends', () => {
        expect(durationsFor('none', { writing: 9 })).toBeNull();
        expect(durationsFor('standard', { writing: 9 })).toEqual(
            StandardDurations,
        );
        expect(durationsFor('custom', { writing: 9, voting: 0 })).toEqual({
            writing: 9,
        });
    });
});

describe('customStart', () => {
    it('starts Custom from the standard set, or from the durations set, every phase given', () => {
        expect(customStart(null)).toEqual(StandardDurations);
        expect(customStart({ writing: 10 })).toEqual({
            writing: 10,
            grouping: 0,
            voting: 0,
            discussing: 0,
            actions: 0,
        });
    });
});

describe('summary', () => {
    it('lists the timed phases in phase order, not key order', () => {
        expect(summary({ discussing: 15, writing: 7, voting: 3 }, label)).toBe(
            'Writing 7 · Voting 3 · Discussing 15',
        );
    });

    it('is null without any duration', () => {
        expect(summary(null, label)).toBeNull();
        expect(summary({ writing: 0 }, label)).toBeNull();
    });
});

describe('offerFor', () => {
    it('offers the current phase its minutes in seconds', () => {
        expect(offerFor(StandardDurations, 'writing')).toEqual({
            phase: 'writing',
            seconds: 420,
            perTopic: false,
        });
    });

    it('offers Discussing per topic', () => {
        expect(offerFor(StandardDurations, 'discussing')).toEqual({
            phase: 'discussing',
            seconds: 900,
            perTopic: true,
        });
    });

    it('offers nothing in an untimed phase, a phase without minutes or without durations', () => {
        expect(offerFor(StandardDurations, 'roti')).toBeNull();
        expect(offerFor(StandardDurations, 'icebreaker')).toBeNull();
        expect(offerFor({ writing: 7 }, 'voting')).toBeNull();
        expect(offerFor(null, 'writing')).toBeNull();
    });
});
