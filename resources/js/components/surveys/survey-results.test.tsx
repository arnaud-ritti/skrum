import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SurveyEvent } from '@/hooks/use-survey-channel';
import { renderWithProviders } from '@/test/render';
import {
    mockupComparable,
    mockupComparison,
    mockupQuestions,
    mockupResults,
    surveySnapshot,
} from '@/test/survey-results';
import { SurveyResults } from './survey-results';

type Handlers = {
    onEvent: (event: SurveyEvent) => void;
    onResync: () => void;
};

const channel = vi.hoisted(() => ({ listeners: new Set<Handlers>() }));
const api = vi.hoisted(() => ({
    snapshot: vi.fn(),
    setStatus: vi.fn(),
    comparison: vi.fn(),
}));
const inertia = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('@/hooks/use-survey-channel', async () => {
    const { useEffect, useRef } = await import('react');

    return {
        useSurveyChannel: (
            _id: string,
            _enabled: boolean,
            handlers: Handlers,
        ) => {
            const latest = useRef(handlers);

            latest.current = handlers;

            useEffect(() => {
                const listener: Handlers = {
                    onEvent: (event) => latest.current.onEvent(event),
                    onResync: () => latest.current.onResync(),
                };

                channel.listeners.add(listener);

                return () => {
                    channel.listeners.delete(listener);
                };
            }, []);

            return { online: [], connected: true, reconnecting: false };
        },
    };
});

vi.mock('@/lib/surveys/api', () => ({ surveyApi: api }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { replace: inertia.replace },
    };
});

/** Every mounted render hears the event, as every open tab would. */
function broadcast(event: SurveyEvent): void {
    act(() => {
        for (const listener of channel.listeners) {
            listener.onEvent(event);
        }
    });
}

beforeEach(() => {
    channel.listeners.clear();
    api.snapshot.mockReset();
    api.setStatus.mockReset();
    api.comparison.mockReset();
    inertia.replace.mockReset();
    window.history.replaceState(null, '', '/surveys/survey-1/results');
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SurveyResults', () => {
    it('names its content Results and reads the answers out of the participants', () => {
        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        const region = screen.getByRole('region', { name: 'Results' });

        expect(region.textContent).toContain(
            '9 answers out of 11 participants · anonymous',
        );
        expect(region.textContent).not.toContain('closed on');
    });

    it('reads a single answer in the singular', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    progress: { responses: 1, completed: 1 },
                })}
            />,
        );

        expect(
            screen.getByRole('region', { name: 'Results' }).textContent,
        ).toContain('1 answer out of 11 participants · anonymous');
    });

    it('reads an audience of one in the singular', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    progress: { responses: 1, completed: 1, audience: 1 },
                })}
            />,
        );

        expect(
            screen.getByRole('region', { name: 'Results' }).textContent,
        ).toContain('1 answer out of 1 participant · anonymous');
    });

    it('reads no answer from an audience of one with the participant in the singular', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    progress: { responses: 0, completed: 0, audience: 1 },
                })}
            />,
        );

        expect(
            screen.getByRole('region', { name: 'Results' }).textContent,
        ).toContain('0 answers out of 1 participant · anonymous');
    });

    it('adds the closing date once closed', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    survey: {
                        status: 'closed',
                        closedAt: '2026-10-03T16:00:00+00:00',
                    },
                })}
            />,
        );

        expect(
            screen.getByRole('region', { name: 'Results' }).textContent,
        ).toMatch(/· closed on .*2026/);
    });

    it('offers the three tabs to a member, the summary first', () => {
        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        expect(
            screen.getAllByRole('tab').map((tab) => tab.textContent),
        ).toEqual(['Summary', 'Free-text answers', 'Compare']);
        expect(
            screen
                .getByRole('tab', { name: 'Summary' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(screen.getAllByRole('article')).toHaveLength(5);
    });

    it('leaves out the free-text tab when no question takes free text', () => {
        const questions = mockupQuestions
            .filter((question) => question.kind !== 'text')
            .map((question) => ({ ...question, allowsComment: false }));

        renderWithProviders(
            <SurveyResults initial={surveySnapshot({ questions })} />,
        );

        expect(
            screen.queryByRole('tab', { name: 'Free-text answers' }),
        ).toBeNull();
    });

    it('opens the tab named in the address, and writes the tab it moves to', () => {
        window.history.replaceState(
            null,
            '',
            '/surveys/survey-1/results?tab=free-text',
        );

        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        expect(
            screen
                .getByRole('tab', { name: 'Free-text answers' })
                .getAttribute('aria-selected'),
        ).toBe('true');

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Summary' }), {
            button: 0,
        });

        expect(inertia.replace).toHaveBeenLastCalledWith(
            expect.objectContaining({ url: '/surveys/survey-1/results' }),
        );
    });

    it('moves to the free-text tab from the text card', () => {
        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'See the 7 answers' }),
        );

        expect(
            screen
                .getByRole('tab', { name: 'Free-text answers' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(inertia.replace).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: '/surveys/survey-1/results?tab=free-text',
            }),
        );
        expect(document.activeElement).toBe(
            screen.getByRole('heading', { name: 'A word for the team?' }),
        );
    });

    it('says nothing compares yet when no other survey is closed', () => {
        window.history.replaceState(
            null,
            '',
            '/surveys/survey-1/results?tab=compare',
        );

        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        expect(screen.getByRole('tabpanel').textContent).toContain(
            'Nothing to compare with yet.',
        );
    });

    it('shows the threshold of this survey in the Compare tab, not a verdict on the other', () => {
        window.history.replaceState(
            null,
            '',
            '/surveys/survey-1/results?tab=compare',
        );
        api.comparison.mockResolvedValue({
            comparison: { ...mockupComparison, belowThreshold: true },
        });

        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    progress: { responses: 1, completed: 1 },
                    results: {
                        belowThreshold: true,
                        responses: 1,
                        questions: {},
                    },
                    comparable: mockupComparable,
                })}
            />,
        );

        const panel = screen.getByRole('tabpanel');

        expect(panel.textContent).toContain(
            'Results appear from 3 answers. 1 so far.',
        );
        expect(panel.textContent).not.toContain(
            'The other survey does not have enough answers.',
        );
        expect(api.comparison).not.toHaveBeenCalled();
    });

    it('tells a member who may not see results yet when they will, in the Compare tab too', () => {
        window.history.replaceState(
            null,
            '',
            '/surveys/survey-1/results?tab=compare',
        );

        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    me: { isEditor: false, canSeeResults: false },
                    results: null,
                    comparable: null,
                })}
            />,
        );

        const panel = screen.getByRole('tabpanel');

        expect(panel.textContent).toContain(
            'Results will show when the survey is closed.',
        );
        expect(panel.textContent).not.toContain('Nothing to compare with yet.');
    });

    it('shows the threshold below it, and no card', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    progress: { responses: 2, completed: 2 },
                    results: {
                        belowThreshold: true,
                        responses: 2,
                        questions: {},
                    },
                })}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Results appear from 3 answers. 2 so far.',
        );
        expect(screen.queryByRole('article')).toBeNull();
    });

    it('tells a member who may not see results yet when they will', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    me: { isEditor: false, canSeeResults: false },
                    results: null,
                    comparable: null,
                })}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            'Results will show when the survey is closed.',
        );
        expect(
            screen.queryByRole('button', { name: 'Close the survey' }),
        ).toBeNull();
    });

    it('shows a closed survey with its export, and reopening in the "…" menu of an editor', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    survey: {
                        status: 'closed',
                        closedAt: '2026-10-03T16:00:00+00:00',
                    },
                })}
            />,
        );

        expect(screen.getByText('Survey closed')).not.toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'Export CSV' })
                .getAttribute('href'),
        ).toBe('/surveys/survey-1/export');
        expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'More actions' }),
        ).not.toBeNull();
    });

    it('gives a guest its own main, without the compare tab', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    survey: { teamName: null, guestUrl: null },
                    me: {
                        isGuest: true,
                        isEditor: false,
                        name: 'Blue Fox',
                    },
                    comparable: null,
                })}
            />,
        );

        expect(screen.getByRole('main', { name: 'Results' })).not.toBeNull();
        expect(screen.queryByRole('tab', { name: 'Compare' })).toBeNull();
        expect(screen.getByText('Open')).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Share with the team' }),
        ).toBeNull();
    });

    it('puts "Share with the team" in the header of a member, opening the Share dialog', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot()}
                layout={({ actions, children }) => (
                    <>
                        <header data-test="topbar">{actions}</header>
                        {children}
                    </>
                )}
            />,
        );

        fireEvent.click(
            within(
                document.querySelector('[data-test="topbar"]') as HTMLElement,
            ).getByRole('button', { name: 'Share with the team' }),
        );

        expect(screen.getByRole('dialog')).not.toBeNull();
    });

    it('hands its status and its actions to the layout of a member', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot()}
                layout={({ status, actions, children }) => (
                    <>
                        <header data-test="topbar">
                            <span data-test="status">{status}</span>
                            {actions}
                        </header>
                        {children}
                    </>
                )}
            />,
        );

        expect(
            within(
                document.querySelector('[data-test="topbar"]') as HTMLElement,
            ).getByRole('button', { name: 'Close the survey' }),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-test="status"]')?.textContent,
        ).toBe('Open');
    });

    it('closes through the API, then reads the closed survey', async () => {
        api.setStatus.mockResolvedValue(null);
        api.snapshot.mockResolvedValue(
            surveySnapshot({
                survey: {
                    status: 'closed',
                    version: 5,
                    closedAt: '2026-10-03T16:00:00+00:00',
                },
            }),
        );

        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Close the survey' }),
        );
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Close the survey' }),
        );

        expect(
            await screen.findByRole('link', { name: 'Export CSV' }),
        ).not.toBeNull();
        expect(api.setStatus).toHaveBeenCalledWith('survey-1', 'closed');
    });
});

describe('SurveyResults live', () => {
    function renderTwoViewers() {
        const editor = renderWithProviders(
            <SurveyResults initial={surveySnapshot()} />,
        );
        const member = renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    me: { isEditor: false, canSeeResults: false },
                    results: null,
                    comparable: null,
                })}
            />,
        );

        return { editor, member };
    }

    it('moves the header count of both at once, the audience with it', () => {
        const { editor, member } = renderTwoViewers();

        broadcast({
            name: 'survey.responses.changed',
            payload: { responses: 10, completed: 10, audience: 12 },
        });

        for (const view of [editor, member]) {
            expect(
                within(view.container).getByRole('region', { name: 'Results' })
                    .textContent,
            ).toContain('10 answers out of 12 participants');
        }
    });

    it('refetches after a second for the viewer who may see results only', async () => {
        vi.useFakeTimers();
        const results = structuredClone(mockupResults);

        results.questions['q-scale'].mean = 4.1;
        api.snapshot.mockResolvedValue(
            surveySnapshot({ progress: { responses: 10 }, results }),
        );

        const { editor } = renderTwoViewers();

        broadcast({
            name: 'survey.responses.changed',
            payload: { responses: 10, completed: 10, audience: 11 },
        });

        expect(api.snapshot).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(api.snapshot).toHaveBeenCalledTimes(1);
        expect(
            within(editor.container).getByRole('article', {
                name: 'Workload of the sprint',
            }).textContent,
        ).toContain('4.1');
    });

    it('swaps the badge and offers the export to an editor once closed elsewhere', async () => {
        api.snapshot.mockResolvedValue(
            surveySnapshot({
                survey: {
                    status: 'closed',
                    version: 5,
                    closedAt: '2026-10-03T16:00:00+00:00',
                },
            }),
        );

        const { container: editor } = renderWithProviders(
            <SurveyResults initial={surveySnapshot()} />,
        );

        broadcast({
            name: 'survey.changed',
            payload: { version: 5, status: 'closed' },
        });

        await waitFor(() =>
            expect(
                within(editor).getByRole('link', { name: 'Export CSV' }),
            ).not.toBeNull(),
        );
        expect(within(editor).getByText('Survey closed')).not.toBeNull();
        expect(within(editor).queryByText('Open')).toBeNull();
    });
});

describe('SurveyResults compared', () => {
    it('loads the default comparison once and puts its differences on the cards', async () => {
        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({ comparable: mockupComparable })}
            />,
        );

        await waitFor(() =>
            expect(
                screen
                    .getByRole('article', {
                        name: 'Would you recommend the team?',
                    })
                    .querySelector('[data-slot="survey-delta"]')?.textContent,
            ).toContain('+11 vs Sprint 41'),
        );
        expect(
            screen
                .getByRole('article', { name: 'Which ritual must we keep?' })
                .querySelector('[data-slot="survey-delta"]'),
        ).toBeNull();
        expect(api.comparison).toHaveBeenCalledTimes(1);
        expect(api.comparison).toHaveBeenCalledWith('survey-1', 'survey-41');
    });

    it('asks for nothing when there is no default to compare with', () => {
        renderWithProviders(<SurveyResults initial={surveySnapshot()} />);

        expect(api.comparison).not.toHaveBeenCalled();
        expect(document.querySelector('[data-slot="survey-delta"]')).toBeNull();
    });

    it('shows the default comparison in the Compare tab without asking again', async () => {
        window.history.replaceState(
            null,
            '',
            '/surveys/survey-1/results?tab=compare',
        );
        api.comparison.mockResolvedValue({ comparison: mockupComparison });

        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({ comparable: mockupComparable })}
            />,
        );

        expect(
            await screen.findByRole('listitem', {
                name: 'Workload of the sprint',
            }),
        ).not.toBeNull();
        expect(api.comparison).toHaveBeenCalledTimes(1);
    });
});

describe('SurveyResults export', () => {
    const closed = {
        status: 'closed',
        closedAt: '2026-10-03T16:00:00+00:00',
    } as const;

    it('links an editor of a closed survey to the export route, the server naming the file', () => {
        renderWithProviders(
            <SurveyResults initial={surveySnapshot({ survey: closed })} />,
        );

        const link = screen.getByRole('link', { name: 'Export CSV' });

        expect(link.getAttribute('href')).toBe('/surveys/survey-1/export');
        expect(link.hasAttribute('download')).toBe(false);
    });

    it('offers no export below the threshold', () => {
        renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    survey: closed,
                    progress: { responses: 2, completed: 2 },
                    results: {
                        belowThreshold: true,
                        responses: 2,
                        questions: {},
                    },
                })}
            />,
        );

        expect(screen.queryByRole('link', { name: 'Export CSV' })).toBeNull();
    });

    it('offers no export to a member who does not edit, nor while open', () => {
        const member = renderWithProviders(
            <SurveyResults
                initial={surveySnapshot({
                    survey: closed,
                    me: { isEditor: false },
                })}
            />,
        );

        expect(
            within(member.container).queryByRole('link', {
                name: 'Export CSV',
            }),
        ).toBeNull();

        const open = renderWithProviders(
            <SurveyResults initial={surveySnapshot()} />,
        );

        expect(
            within(open.container).queryByRole('link', { name: 'Export CSV' }),
        ).toBeNull();
    });
});
