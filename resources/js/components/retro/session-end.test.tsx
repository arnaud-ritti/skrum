import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    hasSessionEndActions,
    SessionEnd,
} from '@/components/retro/session-end';
import type {
    ActionItem,
    BoardCard,
    HealthResults,
    Results,
    Snapshot,
} from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());
const mobile = vi.hoisted(() => ({ value: false }));
const reducedMotion = vi.hoisted(() => ({ value: false }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => mobile.value,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const health: HealthResults = {
    statements: [
        {
            key: 'vision',
            label: 'Vision',
            text: 'We know where we go',
            isBuiltin: true,
            average: 3.5,
            count: 2,
            previousAverage: 3,
            distribution: [0, 0, 1, 1, 0],
        },
        {
            key: 'processes',
            label: 'Processes',
            text: 'Nothing blocks me',
            isBuiltin: true,
            average: 2,
            count: 2,
            previousAverage: null,
            distribution: [0, 1, 1, 0, 0],
        },
    ],
    score: 2.8,
    participation: { respondents: 2, participants: 3 },
    topStrength: { key: 'vision', label: 'Vision', average: 3.5 },
    growthArea: { key: 'processes', label: 'Processes', average: 2 },
    alignment: { value: 9, level: 'high', label: 'High team consensus' },
    assessment: { band: 'good', title: 'Good', sentence: 'Keep going.' },
};

function results(overrides: Partial<Results> = {}): Results {
    return {
        participants: [
            {
                id: 'me',
                name: 'Alice Martin',
                avatarUrl: '/a.svg',
                isGuest: false,
            },
            { id: 'carol', name: 'Carol', avatarUrl: '/c.svg', isGuest: true },
        ],
        health: null,
        healthTrend: null,
        surveys: [],
        games: null,
        roti: {
            distribution: [1, 2, 3, 4, 5].map((score) => ({
                score,
                count: score === 4 ? 2 : 0,
            })),
            average: 4,
            respondents: 2,
        },
        summary: null,
        deliveries: [],
        emailRecipients: { participants: 1, team: 3 },
        stats: {
            votesCast: 3,
            votesAvailable: 10,
            participation: { participants: 2, expected: 3 },
            durationSeconds: 3480,
        },
        ...overrides,
    };
}

function actionItem(id: string, content: string): ActionItem {
    return {
        id,
        retroId: 'retro-1',
        teamId: 'team-1',
        content,
        priority: 'medium',
        dueOn: null,
        isOverdue: false,
        status: 'open',
        completedAt: null,
        completedVia: null,
        assignee: null,
        createdBy: null,
        isMine: false,
        commentCount: 0,
        source: null,
        themeId: null,
        themeName: null,
        recurrence: null,
        previousOccurrenceId: null,
        createdAt: '2026-10-02T09:00:00Z',
        subtasks: [],
        externalLinks: [],
        cardId: null,
    } as unknown as ActionItem;
}

function card(id: string, overrides: Partial<BoardCard> = {}): BoardCard {
    return {
        id,
        columnId: 'col',
        parentCardId: null,
        content: `Card ${id}`,
        groupName: null,
        discussedAt: null,
        gif: null,
        votes: 0,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
        ...overrides,
    } as unknown as BoardCard;
}

function ended(overrides: Partial<Snapshot> = {}, retro = {}, viewer = {}) {
    return retroSnapshot({
        retro: {
            phase: 'completed',
            completedAt: '2026-10-02T10:00:00Z',
            ...retro,
        },
        viewer,
        cards: [
            card('lead', { groupName: 'Pipeline', votes: 3 }),
            card('child', { parentCardId: 'lead' }),
            card('alone', { votes: 1 }),
        ],
        actionItems: [
            actionItem('a', 'Buy a faster runner'),
            actionItem('b', 'Tidy the backlog'),
        ],
        results: results(),
        ...overrides,
    });
}

function show(
    snapshot: Snapshot = ended(),
    props: Partial<Parameters<typeof SessionEnd>[0]> = {},
    context = {},
) {
    return renderInBoard(
        <SessionEnd view="results" onViewChange={() => {}} {...props}>
            <p>The columns</p>
        </SessionEnd>,
        boardContext(snapshot, context),
    );
}

const stat = (label: string) =>
    [...document.querySelectorAll('[data-slot="stat-card"]')]
        .find((tile) => tile.textContent?.startsWith(label))
        ?.querySelector('[data-slot="stat-card-value"]')?.textContent;

const section = (title: string) =>
    screen.getByRole('heading', { name: title, level: 2 })
        .parentElement as HTMLElement;

beforeEach(() => {
    retroRequest.mockReset();
    toast.mockReset();
    mobile.value = false;
    reducedMotion.value = false;
    window.matchMedia = ((query: string) => ({
        matches:
            query.includes('prefers-reduced-motion') && reducedMotion.value,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as typeof window.matchMedia;
});

describe('SessionEnd', () => {
    it('says the session has ended, how long it lasted and when, under the title of the retro', () => {
        show();

        const line = document.querySelector(
            '[data-slot="retro-session-end-line"]',
        )?.textContent;

        expect(line).toMatch(/^Session ended · 58 min · \w{3}, Oct 2$/);
        expect(
            screen.getByRole('heading', { name: 'Sprint 42, wrapped up' }),
        ).toBeTruthy();
        expect(screen.getByText('Meetings end, actions stay.')).toBeTruthy();
        expect(
            screen.getByText('Meetings end, actions stay.').parentElement
                ?.textContent,
        ).toContain('2 participants.');
    });

    it('shows no duration for a retro without a start time', () => {
        show(
            ended({
                results: results({
                    stats: { ...results().stats, durationSeconds: null },
                }),
            }),
        );

        expect(
            document.querySelector('[data-slot="retro-session-end-line"]')
                ?.textContent,
        ).toMatch(/^Session ended · \w{3}, Oct 2$/);
    });

    it('gives the five figures: actions, participation, cards, groups, votes cast', () => {
        show();

        expect(stat('Actions created')).toBe('2');
        expect(stat('Participation')).toBe('2 of 3 · 67%');
        expect(stat('Cards')).toBe('3');
        expect(stat('Groups')).toBe('1');
        expect(stat('Votes cast')).toBe('3 of 10');
        expect(
            document
                .querySelector('[data-slot="stat-card"]')
                ?.getAttribute('data-emphasis'),
        ).toBe('true');
    });

    describe('reactions', () => {
        const channel = () => ({
            presence: {
                whisper: vi.fn(),
                listen: vi.fn(),
                stopListening: vi.fn(),
            } as never,
        });

        it('docks the reaction bar under the results, which keep room for it', () => {
            show(ended(), {}, channel());

            expect(
                screen.getByRole('toolbar', { name: 'Reactions' }),
            ).toBeTruthy();
            expect(
                screen.getByRole('button', { name: 'Send a reaction 🎉' }),
            ).toBeTruthy();
            expect(
                document
                    .querySelector('[data-slot="reaction-bar"]')
                    ?.getAttribute('data-variant'),
            ).toBe('floating');
            expect(
                document
                    .querySelector('[data-slot="retro-session-end"]')
                    ?.getAttribute('data-reactions'),
            ).toBe('true');
        });

        it('sends a reaction as a whisper, nothing to the server', async () => {
            const context = channel();

            show(ended(), {}, context);
            await userEvent.click(
                screen.getByRole('button', { name: 'Send a reaction 🎉' }),
            );

            expect(
                (context.presence as { whisper: ReturnType<typeof vi.fn> })
                    .whisper,
            ).toHaveBeenCalled();
            expect(retroRequest).not.toHaveBeenCalled();
        });

        it('has no bar when the reactions are off, nor without a channel', () => {
            const off = show(
                ended({}, { reactionsEnabled: false }),
                {},
                channel(),
            );

            expect(screen.queryByRole('toolbar')).toBeNull();
            expect(
                document
                    .querySelector('[data-slot="retro-session-end"]')
                    ?.hasAttribute('data-reactions'),
            ).toBe(false);
            off.unmount();

            show();

            expect(screen.queryByRole('toolbar')).toBeNull();
        });

        it('is compact on a phone, above the sticky actions', () => {
            mobile.value = true;

            const rect = vi
                .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
                .mockReturnValue({ height: 64 } as DOMRect);

            try {
                show(ended(), {}, channel());

                expect(
                    screen.getByRole('button', { name: 'More reactions' }),
                ).toBeTruthy();
                expect(
                    document.querySelector(
                        '[data-slot="retro-session-end-actions"]',
                    ),
                ).not.toBeNull();
                expect(
                    (
                        document.querySelector(
                            '[data-slot="reaction-bar"]',
                        ) as HTMLElement
                    ).style.getPropertyValue('--reaction-offset'),
                ).toBe('calc(4rem + 0.75rem)');
            } finally {
                rect.mockRestore();
                mobile.value = false;
            }
        });
    });

    it('has the Results and Board tabs under the header, with their ids', () => {
        const onViewChange = vi.fn();

        show(ended(), { onViewChange });

        const results = screen.getByRole('tab', { name: 'Results' });
        const board = screen.getByRole('tab', { name: 'Board' });

        expect(results.id).toBe('completed-tab-results');
        expect(board.id).toBe('completed-tab-board');
        expect(results.getAttribute('aria-selected')).toBe('true');
        expect(
            screen.getByRole('tabpanel').getAttribute('aria-labelledby'),
        ).toBe('completed-tab-results');
        expect(screen.queryByText('The columns')).toBeNull();

        fireEvent.mouseDown(board);

        expect(onViewChange).toHaveBeenCalledWith('board');
    });

    it('shows the board in place of the results on the Board tab and keeps the header', () => {
        show(ended(), { view: 'board' });

        expect(screen.getByText('The columns')).toBeTruthy();
        expect(
            screen.getByRole('tabpanel').getAttribute('aria-labelledby'),
        ).toBe('completed-tab-board');
        expect(
            screen.queryByRole('heading', { name: 'Top topics' }),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="retro-session-end-stats"]'),
        ).toBeNull();
        expect(
            screen.getByRole('heading', { name: 'Sprint 42, wrapped up' }),
        ).toBeTruthy();
    });

    it('lists the actions first, then the ROTI, then the rest, each under its heading', () => {
        show();

        const titles = [...document.querySelectorAll('section > h2')].map(
            (title) => title.textContent,
        );

        expect(titles).toEqual([
            'Actions created',
            'Return on time invested',
            'Thanks for participating',
            'Top topics',
        ]);
    });

    it('shows the surveys read only under "Surveys", after the top topics', () => {
        show(
            ended({
                results: results({
                    surveys: [
                        {
                            id: 'survey-1',
                            kind: 'single',
                            question: 'How was the sprint?',
                            description: null,
                            position: 0,
                            isClosed: false,
                            version: 1,
                            showVoters: false,
                            responseCount: 1,
                            myOptionIds: ['great'],
                            myText: null,
                            resultsVisible: true,
                            options: [
                                {
                                    id: 'great',
                                    label: 'Great',
                                    position: 0,
                                    count: 1,
                                    voters: null,
                                },
                            ],
                            textAnswers: null,
                            reactions: [],
                            commentCount: 0,
                            comments: [],
                        },
                    ],
                }),
            }),
        );

        const titles = [...document.querySelectorAll('section > h2')].map(
            (title) => title.textContent,
        );
        const survey = within(section('Surveys')).getByRole('article', {
            name: 'How was the sprint?',
        });

        expect(titles.slice(-2)).toEqual(['Top topics', 'Surveys']);
        expect(within(survey).queryByRole('radio')).toBeNull();
        expect(
            survey.querySelector('[data-slot="survey-result-bar"] > div'),
        ).not.toBeNull();
        expect(
            document.querySelector('[aria-label="Survey actions"]'),
        ).toBeNull();
    });

    it('lists the action items read only, with their count and a link to those of the team', () => {
        show(
            ended({
                links: {
                    team: '/teams/team-1',
                    actionItems: '/acme/action-items?team=team-1',
                    workspace: 'acme',
                },
            }),
        );

        const actions = section('Actions created');

        expect(
            actions.querySelector('[data-slot="retro-actions-created-count"]')
                ?.textContent,
        ).toBe('2');
        expect(actions.querySelector('#action-item-a')?.textContent).toContain(
            'Buy a faster runner',
        );
        expect(within(actions).queryByRole('textbox')).toBeNull();
        expect(
            within(actions)
                .getAllByRole('button', { name: 'Mark as done' })
                .every((button) => button.hasAttribute('disabled')),
        ).toBe(true);
        expect(
            within(actions).queryByRole('button', {
                name: 'Delete action item',
            }),
        ).toBeNull();
        expect(
            within(actions)
                .getByRole('link', { name: "View the team's action items" })
                .getAttribute('href'),
        ).toBe('/acme/action-items?team=team-1');
    });

    it('says how many action items have a ticket and that all have an owner and a due date', () => {
        const owned = {
            assignee: { id: 'u', name: 'Bob', kind: 'member' },
            dueOn: '2026-10-10',
        };

        show(
            ended({
                actionItems: [
                    {
                        ...actionItem('a', 'Quarantine the flaky tests'),
                        ...owned,
                        externalLinks: [
                            { id: 'l', source: 'jira', key: 'AT-1', url: '#' },
                        ],
                    },
                    { ...actionItem('b', 'Add a runner'), ...owned },
                ] as unknown as ActionItem[],
            }),
        );

        expect(section('Actions created').textContent).toContain(
            '1 linked to Jira · all have an owner and a due date',
        );
    });

    it('orders the top topics by votes, a group with its name and how many cards it holds', () => {
        show();

        const topics = [
            ...section('Top topics').querySelectorAll('ol > li'),
        ].map((topic) =>
            [...topic.querySelectorAll('p, span')]
                .map((part) => part.textContent)
                .join(' / '),
        );

        expect(topics).toEqual([
            'Pipeline / Card lead / 1 grouped card / 3',
            'Card alone / 1',
        ]);
    });

    it('lists who took part, guests marked', () => {
        show();

        const people = [
            ...section('Thanks for participating').querySelectorAll('li'),
        ].map((person) =>
            [
                ...person.querySelectorAll(
                    ':scope > span:not([data-slot="person-avatar"])',
                ),
            ]
                .map((part) => part.textContent)
                .join(' '),
        );

        expect(people).toEqual(['Alice Martin', 'Carol Guest']);
        expect(
            section('Thanks for participating').querySelectorAll(
                '[data-slot="person-avatar"]',
            ),
        ).toHaveLength(2);
    });

    describe('ROTI', () => {
        it('shows the average and the distribution alone on a retro that went through the ROTI phase', () => {
            show();

            const roti = section('Return on time invested');

            expect(
                roti.querySelector('[data-slot="roti-mean"]')?.textContent,
            ).toBe('4.0/ 5');
            expect(roti.textContent).toContain('2 votes');
            expect(
                roti.querySelector('li[data-rating="4"] b')?.textContent,
            ).toBe('2');
            expect(
                screen.queryByRole('group', {
                    name: 'Was this time together worth it?',
                }),
            ).toBeNull();
        });

        it('still takes a rating on a retro completed before the ROTI phase existed', () => {
            show(
                ended({
                    roti: {
                        myScore: 4,
                        respondents: 2,
                        voterIds: ['me', 'bob'],
                        canVote: true,
                        revealed: false,
                        results: null,
                    },
                }),
            );

            expect(
                screen
                    .getByRole('group', {
                        name: 'Was this time together worth it?',
                    })
                    .querySelector('button[aria-pressed="true"]')?.textContent,
            ).toContain('Useful');
        });

        it('says so when nobody has voted', () => {
            show(
                ended({
                    results: results({
                        roti: {
                            distribution: [],
                            average: null,
                            respondents: 0,
                        },
                    }),
                }),
            );

            expect(section('Return on time invested').textContent).toContain(
                'Nobody has voted yet.',
            );
        });
    });

    describe('health check', () => {
        const withHealth = (trend: Results['healthTrend']) =>
            ended({ results: results({ health, healthTrend: trend }) });
        const trend = [
            {
                retroId: 'r-41',
                surveyId: 's-41',
                title: 'Sprint 41',
                completedAt: '2026-09-18T10:00:00Z',
                score: 3.3,
                url: '/retros/r-41',
                delta: null,
                sameStatements: true,
            },
            {
                retroId: 'retro-1',
                surveyId: 's-42',
                title: 'Sprint 42',
                completedAt: '2026-10-02T10:00:00Z',
                score: 2.8,
                url: '/retros/retro-1',
                delta: -0.5,
                sameStatements: true,
            },
        ];

        const openDetails = async () => {
            await userEvent.click(
                within(section('Health check')).getByRole('button', {
                    name: 'Details',
                }),
            );

            return screen.getByRole('dialog', { name: 'Health check' });
        };

        it('is the compact card: answers, average, one row per statement with its move, the alert', () => {
            show(withHealth(trend));

            const card = section('Health check');
            const row = (key: string) =>
                card.querySelector(`[data-statement-key="${key}"]`);

            expect(card.textContent).toContain('2 answers · avg 2.8');
            expect(within(card).getAllByRole('listitem')).toHaveLength(2);
            expect(
                row('vision')?.querySelector(
                    '[data-slot="health-compact-delta"]',
                )?.textContent,
            ).toBe('+0.5vs Sprint 41');
            expect(row('processes')?.getAttribute('data-alert')).toBe('true');
            expect(
                card.querySelector('svg[aria-label="Team health radar"]'),
            ).toBeNull();
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('opens the full results from "Details": figures, radar, trend and each statement with its move since the previous retro', async () => {
            show(withHealth(trend));

            const dialog = await openDetails();
            const row = (key: string) =>
                dialog.querySelector(`[data-statement-key="${key}"]`);

            expect(
                dialog.querySelector('svg[aria-label="Team health radar"]'),
            ).not.toBeNull();
            expect(
                within(
                    within(dialog).getByRole('group', {
                        name: 'Trend across retros',
                    }),
                )
                    .getAllByRole('link')
                    .map((link) => link.getAttribute('aria-label')),
            ).toEqual(['Sprint 41: 3.3/5', 'Sprint 42: 2.8/5']);
            expect(dialog.textContent).toContain(
                '2 answers from 3 participants · compared with Sprint 41',
            );
            expect(dialog.textContent).toContain('Top strength');
            expect(dialog.textContent).toContain('High team consensus');
            expect(dialog.textContent).toContain('Keep going.');
            expect(
                row('vision')?.querySelector('[data-slot="health-trend"]')
                    ?.textContent,
            ).toBe('+0.5vs Sprint 41');
            expect(
                row('processes')?.querySelector('[data-slot="health-trend"]'),
            ).toBeNull();
            expect(row('processes')?.textContent).toContain('Needs attention');
            expect(row('processes')?.textContent).toContain(
                'Nothing blocks me',
            );
            expect(dialog.textContent).toContain(
                '-0.5 since the previous retro',
            );
        });

        it('has no trend across retros for a guest, in the details either', async () => {
            show(withHealth(null), {}, {});

            const dialog = await openDetails();

            expect(
                dialog.querySelector('svg[aria-label="Team health radar"]'),
            ).not.toBeNull();
            expect(
                dialog.querySelector('svg[aria-label="Trend across retros"]'),
            ).toBeNull();
        });

        it('is absent when the retro had no health check', () => {
            show();

            expect(
                screen.queryByRole('heading', { name: 'Health check' }),
            ).toBeNull();
        });
    });

    describe('recap', () => {
        const channels = {
            slack: true,
            telegram: true,
            msteams: false,
            mattermost: false,
            webhook: false,
        };

        it('has "Send the recap by e-mail" as its main button, which opens the recipients', async () => {
            retroRequest.mockResolvedValue({ id: 'delivery' });

            const { ctx } = show(
                ended({ integrations: { ...channels, email: true } }),
            );

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Send the recap by e-mail',
                }),
            );

            const dialog = screen.getByRole('dialog', {
                name: 'Email the results',
            });

            expect(
                within(dialog)
                    .getByRole('radio', {
                        name: 'Participants with an account (1)',
                    })
                    .getAttribute('aria-checked'),
            ).toBe('true');
            expect(
                within(dialog).getByRole('radio', {
                    name: 'All team members (3)',
                }),
            ).toBeTruthy();

            fireEvent.click(
                within(dialog).getByRole('radio', {
                    name: 'All team members (3)',
                }),
            );
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Send' }),
            );

            await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());

            expect(retroRequest.mock.calls[0][1]).toEqual({ audience: 'team' });
            expect(toast).toHaveBeenCalledWith('The results are on their way.');
            await waitFor(() =>
                expect(screen.queryByRole('dialog')).toBeNull(),
            );
        });

        it('keeps the dialog open with the reason when the server refuses', async () => {
            retroRequest.mockRejectedValue(
                new Error('The results were emailed a few minutes ago.'),
            );

            show(ended({ integrations: { ...channels, email: true } }));

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Send the recap by e-mail',
                }),
            );
            fireEvent.click(
                within(screen.getByRole('dialog')).getByRole('button', {
                    name: 'Send',
                }),
            );

            expect((await screen.findByRole('alert')).textContent).toContain(
                'The results were emailed a few minutes ago.',
            );
            expect(screen.getByRole('dialog')).toBeTruthy();
        });

        it('offers nobody who cannot be reached and has no Send without a recipient', () => {
            show(
                ended({
                    integrations: { ...channels, email: true },
                    results: results({
                        emailRecipients: { participants: 0, team: 0 },
                    }),
                }),
            );

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Send the recap by e-mail',
                }),
            );

            const dialog = screen.getByRole('dialog');

            expect(
                within(dialog).queryByRole('button', { name: 'Send' }),
            ).toBeNull();
            expect(
                within(dialog)
                    .getAllByRole('radio')
                    .every((radio) => radio.hasAttribute('disabled')),
            ).toBe(true);
        });

        it('has no e-mail button when the instance sends no mail, and no Share without a channel', () => {
            show();

            expect(
                screen.queryByRole('button', {
                    name: 'Send the recap by e-mail',
                }),
            ).toBeNull();
            expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
            expect(
                screen.getByRole('link', { name: 'Back to the team' }),
            ).toBeTruthy();
        });

        it('says what the recap holds before posting it to a channel', async () => {
            retroRequest.mockResolvedValue({ id: 'delivery' });

            show(
                ended(
                    {
                        integrations: { ...channels, email: false },
                        results: results({
                            summary: {
                                status: 'pending',
                                text: null,
                                provider: 'Anthropic',
                            } as Results['summary'],
                        }),
                    },
                    { isAnonymous: true },
                ),
            );

            const user = userEvent.setup();

            await user.click(screen.getByRole('button', { name: 'Share' }));

            expect(
                screen.getAllByRole('menuitem').map((item) => item.textContent),
            ).toEqual(['Share to Slack', 'Share to Telegram']);

            await user.click(
                screen.getByRole('menuitem', { name: 'Share to Slack' }),
            );

            const dialog = await screen.findByRole('dialog', {
                name: 'Share the results to Slack',
            });

            expect(dialog.textContent).toContain(
                'The summary is still being generated and will not be included.',
            );
            expect(dialog.textContent).toContain(
                'Participants are shown as a count. Action items are shown with names.',
            );

            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Send' }),
            );

            await waitFor(() =>
                expect(toast).toHaveBeenCalledWith(
                    'The message is on its way.',
                ),
            );
            expect(retroRequest.mock.calls[0][1]).toEqual({
                channel: 'slack',
                kind: 'results',
            });
        });

        it('gives a guest no way back to the team', () => {
            const guest = ended(
                { links: { team: null, actionItems: null, workspace: null } },
                {},
                { isGuest: true, isFacilitator: false },
            );

            show(guest);

            expect(
                screen.queryByRole('link', { name: 'Back to the team' }),
            ).toBeNull();
            expect(hasSessionEndActions(guest)).toBe(false);
            expect(
                document.querySelector(
                    '[data-slot="retro-session-end-actions"]',
                ),
            ).toBeNull();
        });

        it('sticks the e-mail button to the bottom on a phone, the rest in a menu', () => {
            mobile.value = true;

            show(ended({ integrations: { ...channels, email: true } }));

            const bar = document.querySelector(
                '[data-slot="retro-session-end-actions"]',
            ) as HTMLElement;

            expect(bar.className).toContain('sticky');
            expect(
                within(bar).getByRole('button', {
                    name: 'Send the recap by e-mail',
                }),
            ).toBeTruthy();
            expect(
                within(bar).getByRole('button', { name: 'More actions' }),
            ).toBeTruthy();
            expect(
                screen.queryByRole('link', { name: 'Back to the team' }),
            ).toBeNull();
        });
    });

    describe('confetti', () => {
        const confetti = () =>
            document.querySelector('[data-slot="session-confetti"]');

        it('plays for who saw the session end', () => {
            show(ended(), { celebrates: true });

            expect(confetti()?.getAttribute('aria-hidden')).toBe('true');
            expect(confetti()?.children).toHaveLength(40);
            expect(toast).not.toHaveBeenCalled();
        });

        it('does not play on a later visit', () => {
            show();

            expect(confetti()).toBeNull();
        });

        it('is replaced by a toast for who prefers reduced motion', () => {
            reducedMotion.value = true;

            show(ended(), { celebrates: true });

            expect(confetti()).toBeNull();
            expect(toast).toHaveBeenCalledTimes(1);
            expect(toast).toHaveBeenCalledWith(
                'Session ended — 2 actions created',
            );
        });
    });
});
