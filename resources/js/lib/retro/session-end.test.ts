import { describe, expect, it } from 'vitest';
import {
    formatSessionDuration,
    linkedItemsSummary,
    sessionEndStats,
    toHealthResults,
    toRotiResult,
} from '@/lib/retro/session-end';
import type {
    ActionItem,
    BoardCard,
    HealthResults,
    Results,
} from '@/lib/retro/types';
import { retroSnapshot } from '@/test/retro-board';
import type { ExternalLink } from '@/types/integrations';

function card(id: string, parentCardId: string | null = null): BoardCard {
    return { id, parentCardId } as BoardCard;
}

function results(stats: Partial<Results['stats']> = {}): Results {
    return {
        participants: [],
        health: null,
        healthTrend: null,
        surveys: [],
        games: null,
        roti: { distribution: [], average: null, respondents: 0 },
        summary: null,
        deliveries: [],
        emailRecipients: null,
        stats: {
            votesCast: 34,
            votesAvailable: 40,
            participation: { participants: 8, teamMembers: 9 },
            durationSeconds: 3480,
            ...stats,
        },
    };
}

describe('sessionEndStats', () => {
    it('counts the action items, every card, the groups and reads the rest from the server', () => {
        const stats = sessionEndStats(
            retroSnapshot({
                cards: [
                    card('lead'),
                    card('child-1', 'lead'),
                    card('child-2', 'lead'),
                    card('alone'),
                    card('other-lead'),
                    card('child-3', 'other-lead'),
                ],
                actionItems: [{ id: 'a' }, { id: 'b' }] as ActionItem[],
                results: results(),
            }),
        );

        expect(stats).toEqual({
            actions: 2,
            participants: 8,
            teamMembers: 9,
            participationRatio: 8 / 9,
            cards: 6,
            groups: 2,
            votesCast: 34,
            votesAvailable: 40,
        });
    });

    it('has no participation ratio for a team without members and never goes over the whole team', () => {
        expect(
            sessionEndStats(
                retroSnapshot({
                    results: results({
                        participation: { participants: 2, teamMembers: 0 },
                    }),
                }),
            )?.participationRatio,
        ).toBeNull();
        expect(
            sessionEndStats(
                retroSnapshot({
                    results: results({
                        participation: { participants: 4, teamMembers: 3 },
                    }),
                }),
            )?.participationRatio,
        ).toBe(1);
    });

    it('is null without results', () => {
        expect(sessionEndStats(retroSnapshot())).toBeNull();
    });
});

describe('formatSessionDuration', () => {
    it('writes minutes under an hour', () => {
        expect(formatSessionDuration(3480, 'en')).toBe('58 min');
        expect(formatSessionDuration(3000, 'en')).toBe('50 min');
    });

    it('writes hours and minutes from an hour on', () => {
        expect(formatSessionDuration(4320, 'en')).toBe('1 h 12 min');
        expect(formatSessionDuration(7200, 'en')).toBe('2 h');
    });

    it('never says zero minutes', () => {
        expect(formatSessionDuration(20, 'en')).toBe('1 min');
    });
});

describe('toRotiResult', () => {
    it('turns the rows of the server into one count per score', () => {
        expect(
            toRotiResult({
                distribution: [
                    { score: 1, count: 0 },
                    { score: 2, count: 1 },
                    { score: 3, count: 2 },
                    { score: 4, count: 3 },
                    { score: 5, count: 2 },
                ],
                average: 3.75,
                respondents: 8,
            }),
        ).toEqual({
            mean: 3.75,
            votes: 8,
            distribution: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 2 },
        });
    });

    it('has no mean and five zeros while nobody has voted', () => {
        expect(
            toRotiResult({ distribution: [], average: null, respondents: 0 }),
        ).toEqual({
            mean: null,
            votes: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        });
    });
});

describe('toHealthResults', () => {
    const health: HealthResults = {
        statements: [
            {
                key: 'vision',
                label: 'Vision',
                text: 'We know where we go',
                isBuiltin: true,
                average: 4,
                count: 2,
                previousAverage: 6,
            },
            {
                key: 'processes',
                label: 'Processes',
                text: 'Nothing blocks me',
                isBuiltin: true,
                average: null,
                count: 0,
                previousAverage: null,
            },
        ],
        score: 7,
        participation: { respondents: 2, participants: 3 },
        topStrength: { key: 'vision', label: 'Vision', average: 4 },
        growthArea: null,
        alignment: { value: 9, level: 'high', label: 'High team consensus' },
        assessment: { band: 'good', title: 'Good', sentence: 'Keep going.' },
    };

    it('keeps each statement with its previous average and the figures of the summary', () => {
        expect(toHealthResults(health)).toEqual({
            respondents: 2,
            participants: 3,
            results: [
                {
                    key: 'vision',
                    label: 'Vision',
                    text: 'We know where we go',
                    average: 4,
                    count: 2,
                    previousAverage: 6,
                },
                {
                    key: 'processes',
                    label: 'Processes',
                    text: 'Nothing blocks me',
                    average: null,
                    count: 0,
                    previousAverage: null,
                },
            ],
            summary: {
                score: 7,
                topStrength: { label: 'Vision', average: 4 },
                growthArea: null,
                alignment: { value: 9, label: 'High team consensus' },
                assessment: { title: 'Good', sentence: 'Keep going.' },
            },
        });
    });
});

describe('linkedItemsSummary', () => {
    const item = (overrides: Partial<ActionItem>): ActionItem =>
        ({
            externalLinks: [],
            assignee: null,
            dueOn: null,
            ...overrides,
        }) as ActionItem;
    const jira = { source: 'jira' } as ExternalLink;
    const linear = { source: 'linear' } as ExternalLink;
    const owner = { id: 'u' } as ActionItem['assignee'];

    it('counts the items linked to a ticket and names the tracker when there is one', () => {
        expect(
            linkedItemsSummary([
                item({ externalLinks: [jira] }),
                item({ externalLinks: [jira] }),
                item({}),
            ]),
        ).toEqual({ linked: 2, tracker: 'jira', allOwnedAndDated: false });
    });

    it('names no tracker when the tickets live in several', () => {
        expect(
            linkedItemsSummary([
                item({ externalLinks: [jira] }),
                item({ externalLinks: [linear] }),
            ]).tracker,
        ).toBeNull();
    });

    it('says when every item has an owner and a due date, never for an empty list', () => {
        expect(
            linkedItemsSummary([
                item({ assignee: owner, dueOn: '2026-10-10' }),
                item({ assignee: owner, dueOn: '2026-10-17' }),
            ]).allOwnedAndDated,
        ).toBe(true);
        expect(
            linkedItemsSummary([item({ assignee: owner })]).allOwnedAndDated,
        ).toBe(false);
        expect(linkedItemsSummary([]).allOwnedAndDated).toBe(false);
    });
});
