import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BoardActions,
    BoardPhases,
    BoardPresence,
    BoardTimer,
    BoardTitle,
    boardSelf,
} from '@/components/retro/board-topbar';
import {
    ActivityContext,
    type RetroActivity,
} from '@/hooks/use-retro-activity';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

const inMinutes = (minutes: number) =>
    new Date(Date.now() + minutes * 60_000).toISOString();

const actions = (
    <BoardActions hideMyCursor={false} onHideMyCursorChange={vi.fn()} />
);

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ phase: 'grouping' });
});

describe('BoardTitle', () => {
    it('is the h1 of the page, with the way back to the team', () => {
        renderInBoard(<BoardTitle />, boardContext());

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/teams/team-1');
    });

    it('says when the board is closed for editing, and gives a guest no way back', () => {
        renderInBoard(
            <BoardTitle />,
            boardContext(
                retroSnapshot({
                    retro: { isLocked: true },
                    links: { team: null, actionItems: null, workspace: null },
                }),
            ),
        );

        expect(screen.getByText('Board closed for editing')).toBeTruthy();
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('names the team above the title, and only the kind of session for a guest', () => {
        const { container, unmount } = renderInBoard(
            <BoardTitle />,
            boardContext(),
        );

        expect(
            container.querySelector('[data-slot="session-overline"]')
                ?.textContent,
        ).toBe('Atlas · Retrospective');

        unmount();

        const guest = renderInBoard(
            <BoardTitle />,
            boardContext(retroSnapshot({ retro: { teamName: null } })),
        );

        expect(
            guest.container.querySelector('[data-slot="session-overline"]')
                ?.textContent,
        ).toBe('Retrospective');
    });
});

describe('BoardTitle on a phone', () => {
    const subtitle = (container: HTMLElement) =>
        container.querySelector('[data-slot="session-subtitle"]')?.textContent;

    it('says the phase and its place under the title', () => {
        const { container, unmount } = renderInBoard(
            <BoardTitle />,
            boardContext(),
        );

        expect(subtitle(container)).toBe('Writing · 1/6');

        unmount();

        const voting = renderInBoard(
            <BoardTitle />,
            boardContext(retroSnapshot({ retro: { phase: 'voting' } })),
        );

        expect(subtitle(voting.container)).toBe('Voting · 3/6');
    });

    it('says "Completed" once the retro is over', () => {
        const { container } = renderInBoard(
            <BoardTitle />,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
        );

        expect(subtitle(container)).toBe('Completed');
    });
});

describe('boardSelf', () => {
    it('is the viewer among the participants, a guest included', () => {
        expect(boardSelf(retroSnapshot())).toEqual({
            name: 'Alice Martin',
            avatarUrl: '/a.svg',
            isGuest: false,
        });
        expect(
            boardSelf(
                retroSnapshot({
                    viewer: { participantId: 'guest-1', isGuest: true },
                    participants: [
                        {
                            id: 'guest-1',
                            name: 'Visitor',
                            avatarUrl: '/g.svg',
                            isGuest: true,
                        },
                    ],
                }),
            ),
        ).toEqual({ name: 'Visitor', avatarUrl: '/g.svg', isGuest: true });
        expect(boardSelf(retroSnapshot({ participants: [] }))).toBeNull();
    });
});

describe('BoardPhases', () => {
    it('lists the phases without the completed state and marks the current one', () => {
        renderInBoard(<BoardPhases />, boardContext());

        const rail = screen.getByRole('list', { name: 'Phases' });
        const steps = [
            ...rail.querySelectorAll('[data-slot="phase-step"]'),
        ].map((step) => step.querySelector('.truncate')?.textContent);

        expect(steps).toEqual([
            'Writing',
            'Grouping',
            'Voting',
            'Discussing',
            'Actions',
            'ROTI',
        ]);
        expect(
            rail.querySelector('[aria-current="step"]')?.textContent,
        ).toContain('Writing');
    });

    it('has no health check step, with the icebreaker first when enabled and a health check attached', () => {
        renderInBoard(
            <BoardPhases />,
            boardContext(
                retroSnapshot({
                    retro: {
                        icebreakerEnabled: true,
                        phase: 'icebreaker',
                        phases: [
                            'icebreaker',
                            'writing',
                            'grouping',
                            'voting',
                            'discussing',
                            'actions',
                            'roti',
                            'completed',
                        ],
                    },
                    healthCheck: {
                        surveyId: 'survey-1',
                        isClosed: false,
                        scale: 5,
                        respondents: 0,
                        participants: 3,
                        hasSubmitted: false,
                        statements: [],
                        results: null,
                    },
                }),
            ),
        );

        const steps = [
            ...screen
                .getByRole('list', { name: 'Phases' })
                .querySelectorAll('[data-slot="phase-step"]'),
        ].map((step) => step.querySelector('.truncate')?.textContent);

        expect(steps).toEqual([
            'Icebreaker',
            'Writing',
            'Grouping',
            'Voting',
            'Discussing',
            'Actions',
            'ROTI',
        ]);
    });

    it('lets the facilitator move to the next phase, then refetches', async () => {
        const { ctx } = renderInBoard(<BoardPhases />, boardContext());

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/phase'),
            }),
            { phase: 'grouping' },
        );
    });

    it('completes from the last phase and reopens on it', () => {
        const last = renderInBoard(
            <BoardPhases />,
            boardContext(retroSnapshot({ retro: { phase: 'roti' } })),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

        expect(retroRequest).toHaveBeenLastCalledWith(expect.anything(), {
            phase: 'completed',
        });

        last.unmount();

        renderInBoard(
            <BoardPhases />,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

        expect(retroRequest).toHaveBeenLastCalledWith(expect.anything(), {
            phase: 'roti',
        });
        expect(
            document.querySelector('[aria-current="step"]')?.textContent,
        ).toContain('Completed');
    });

    it('is the rail alone on a phone, for the facilitator too', () => {
        renderInBoard(<BoardPhases mobile />, boardContext());

        expect(
            screen
                .getByRole('list', { name: 'Phases' })
                .querySelectorAll('[data-slot="phase-step"]'),
        ).toHaveLength(6);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('gives a participant the rail only', () => {
        renderInBoard(
            <BoardPhases />,
            boardContext(retroSnapshot({ viewer: { isFacilitator: false } })),
        );

        expect(screen.getByRole('list', { name: 'Phases' })).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('BoardPresence', () => {
    function presence(isAnonymous: boolean) {
        const activity: RetroActivity = {
            entries: [
                {
                    senderId: 'bob',
                    kind: 'writing',
                    targetId: 'start',
                    expiresAt: Number.MAX_SAFE_INTEGER,
                },
            ],
            writingCount: 3,
            announce: vi.fn(),
            end: vi.fn(),
        };

        const { container } = renderInBoard(
            <ActivityContext value={activity}>
                <BoardPresence />
            </ActivityContext>,
            boardContext(retroSnapshot({ retro: { isAnonymous } })),
        );

        return {
            ringed: container.querySelectorAll('[data-typing="true"]'),
            line: container.querySelector('[data-slot="presence-stack-typing"]')
                ?.textContent,
        };
    }

    it('rings the writer and names them on a named retro', () => {
        const { ringed, line } = presence(false);

        expect(ringed).toHaveLength(1);
        expect(line).toBe('Bob is writing…');
    });

    it('says only how many write on an anonymous retro, with no ring', () => {
        const { ringed, line } = presence(true);

        expect(ringed).toHaveLength(0);
        expect(line).toBe('3 people are writing…');
    });
});

describe('BoardTimer', () => {
    it('lets the facilitator start a timer from the list 1, 3, 5, 10 and applies the answer', async () => {
        const user = userEvent.setup();
        const endsAt = inMinutes(1);

        retroRequest.mockResolvedValue({ timerEndsAt: endsAt });

        const { ctx } = renderInBoard(<BoardTimer />, boardContext());

        await user.click(screen.getByRole('button', { name: 'Timer' }));

        const menu = screen.getByRole('menu');

        expect(
            within(menu)
                .getAllByRole('menuitem')
                .map((item) => item.textContent),
        ).toEqual(['1 min', '3 min', '5 min', '10 min', 'Stop timer']);

        await user.click(within(menu).getByRole('menuitem', { name: '1 min' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'timer.set',
                timerEndsAt: endsAt,
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/timer'),
            }),
            { seconds: 60 },
        );
    });

    it('offers "+2 min" to the facilitator while a timer runs and applies the new end', async () => {
        const extended = inMinutes(5);

        retroRequest.mockResolvedValue({ timerEndsAt: extended });

        const { ctx } = renderInBoard(
            <BoardTimer />,
            boardContext(
                retroSnapshot({ retro: { timerEndsAt: inMinutes(3) } }),
            ),
        );

        fireEvent.click(await screen.findByRole('button', { name: '+2 min' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'timer.set',
                timerEndsAt: extended,
            }),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: expect.stringContaining('/retros/retro-1/timer/extension'),
            }),
        );
    });

    it('has no "+2 min" before a timer runs', () => {
        renderInBoard(<BoardTimer />, boardContext());

        expect(screen.queryByRole('button', { name: '+2 min' })).toBeNull();
    });

    it('shows a participant the countdown without any control', async () => {
        renderInBoard(
            <BoardTimer />,
            boardContext(
                retroSnapshot({
                    viewer: { isFacilitator: false },
                    retro: { timerEndsAt: inMinutes(3) },
                }),
            ),
        );

        expect(await screen.findByRole('timer')).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('gives nobody a control once the retro is completed', () => {
        renderInBoard(
            <BoardTimer />,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
        );

        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('BoardActions', () => {
    it('has a facilitator menu without a guest link entry', async () => {
        const user = userEvent.setup();

        renderInBoard(actions, boardContext());

        await user.click(
            screen.getByRole('button', { name: 'Facilitator menu' }),
        );

        expect(
            screen.getAllByRole('menuitem').map((item) => item.textContent),
        ).toEqual([
            'Settings…',
            'Hand over facilitation…',
            'Delete retrospective…',
        ]);
    });

    it('opens the settings from the menu and from the settings button', async () => {
        const user = userEvent.setup();

        renderInBoard(actions, boardContext());

        await user.click(
            screen.getByRole('button', { name: 'Facilitator menu' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Settings…' }));

        expect(
            await screen.findByRole('dialog', {
                name: 'Retrospective settings',
            }),
        ).toBeTruthy();

        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        // A press that follows the closing at once is the press that closed it.
        await new Promise((resolve) => setTimeout(resolve, 300));

        await user.click(screen.getByRole('button', { name: 'Settings' }));

        expect(
            await screen.findByRole('dialog', {
                name: 'Retrospective settings',
            }),
        ).toBeTruthy();
    });

    it('opens the Share dialog, where the guest link lives', async () => {
        const user = userEvent.setup();

        renderInBoard(actions, boardContext());

        await user.click(screen.getByRole('button', { name: 'Share' }));

        expect(await screen.findByLabelText('Guest link')).toBeTruthy();
    });

    it('gives a participant the settings and the cursor toggle, no menu and no Share', () => {
        renderInBoard(
            actions,
            boardContext(retroSnapshot({ viewer: { isFacilitator: false } })),
        );

        expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Hide my cursor' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Facilitator menu' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    });

    it('has no cursor toggle where cursors are off', () => {
        renderInBoard(
            actions,
            boardContext(retroSnapshot({ retro: { phase: 'voting' } })),
        );

        expect(
            screen.queryByRole('button', { name: 'Hide my cursor' }),
        ).toBeNull();
    });

    it('moves Share into the menu once the retro is completed', async () => {
        const user = userEvent.setup();

        renderInBoard(
            actions,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
        );

        expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();

        await user.click(
            screen.getByRole('button', { name: 'Facilitator menu' }),
        );

        expect(screen.getByRole('menuitem', { name: 'Share…' })).toBeTruthy();
    });

    describe('health check', () => {
        const attached = (retro: Parameters<typeof retroSnapshot>[0] = {}) =>
            retroSnapshot({
                ...retro,
                healthCheck: {
                    surveyId: 'survey-1',
                    isClosed: false,
                    scale: 5,
                    respondents: 1,
                    participants: 3,
                    hasSubmitted: false,
                    statements: [],
                    results: null,
                },
            });

        it('puts the health check button before Share and opens its dialog', async () => {
            const user = userEvent.setup();

            renderInBoard(actions, boardContext(attached()));

            const healthButton = screen.getByRole('button', {
                name: 'Health check, 1 of 3 answered, your answers not sent',
            });
            const shareButton = screen.getByRole('button', { name: 'Share' });

            expect(
                healthButton.compareDocumentPosition(shareButton) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();

            await user.click(healthButton);

            expect(
                await screen.findByRole('dialog', {
                    name: 'Health check · Sprint 42',
                }),
            ).toBeTruthy();
        });

        it('gives a participant the button too', () => {
            renderInBoard(
                actions,
                boardContext(attached({ viewer: { isFacilitator: false } })),
            );

            expect(
                screen.getByRole('button', {
                    name: 'Health check, 1 of 3 answered, your answers not sent',
                }),
            ).toBeTruthy();
        });

        it('has no button without a health check, nor once the retro is completed', () => {
            const none = renderInBoard(actions, boardContext());

            expect(
                screen.queryByRole('button', { name: /^Health check/ }),
            ).toBeNull();

            none.unmount();

            renderInBoard(
                actions,
                boardContext(attached({ retro: { phase: 'completed' } })),
            );

            expect(
                screen.queryByRole('button', { name: /^Health check/ }),
            ).toBeNull();
        });

        it('is an entry of the one menu on a phone', async () => {
            const user = userEvent.setup();

            renderInBoard(
                <BoardActions
                    mobile
                    hideMyCursor={false}
                    onHideMyCursorChange={vi.fn()}
                />,
                boardContext(attached({ viewer: { isFacilitator: false } })),
            );

            expect(
                screen.queryByRole('button', { name: /^Health check/ }),
            ).toBeNull();

            await user.click(screen.getByRole('button', { name: 'Menu' }));
            await user.click(
                screen.getByRole('menuitem', {
                    name: 'Health check, 1 of 3 answered, your answers not sent',
                }),
            );

            expect(
                await screen.findByRole('dialog', {
                    name: 'Health check · Sprint 42',
                }),
            ).toBeTruthy();
        });
    });

    describe('on a phone', () => {
        const phoneActions = (
            <BoardActions
                mobile
                hideMyCursor={false}
                onHideMyCursorChange={vi.fn()}
            />
        );
        const openMenu = async (name = 'Facilitator menu') => {
            const user = userEvent.setup();

            await user.click(screen.getByRole('button', { name }));

            return user;
        };
        const entries = () =>
            screen.getAllByRole('menuitem').map((item) => item.textContent);

        it('gives the facilitator "Previous" and "Next" at the top of the menu', async () => {
            const { ctx } = renderInBoard(
                phoneActions,
                boardContext(retroSnapshot({ retro: { phase: 'grouping' } })),
            );
            const user = await openMenu();

            expect(entries().slice(0, 3)).toEqual([
                'Previous',
                'Next',
                'Settings…',
            ]);

            retroRequest.mockResolvedValue({ phase: 'voting' });
            await user.click(screen.getByRole('menuitem', { name: 'Next' }));

            await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('/retros/retro-1/phase'),
                }),
                { phase: 'voting' },
            );
        });

        it('goes back with "Previous", which the first phase does not offer', async () => {
            const first = renderInBoard(phoneActions, boardContext());

            await openMenu();

            expect(
                screen
                    .getByRole('menuitem', { name: 'Previous' })
                    .getAttribute('aria-disabled'),
            ).toBe('true');

            first.unmount();

            renderInBoard(
                phoneActions,
                boardContext(retroSnapshot({ retro: { phase: 'grouping' } })),
            );
            const user = await openMenu();

            await user.click(
                screen.getByRole('menuitem', { name: 'Previous' }),
            );

            expect(retroRequest).toHaveBeenLastCalledWith(expect.anything(), {
                phase: 'writing',
            });
        });

        it('completes from the last phase and reopens once completed', async () => {
            const last = renderInBoard(
                phoneActions,
                boardContext(retroSnapshot({ retro: { phase: 'roti' } })),
            );
            let user = await openMenu();

            expect(entries().slice(0, 2)).toEqual(['Previous', 'Complete']);

            await user.click(
                screen.getByRole('menuitem', { name: 'Complete' }),
            );

            expect(retroRequest).toHaveBeenLastCalledWith(expect.anything(), {
                phase: 'completed',
            });

            last.unmount();

            renderInBoard(
                phoneActions,
                boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
            );
            user = await openMenu();

            expect(entries()[0]).toBe('Reopen');
            expect(
                screen.queryByRole('menuitem', { name: 'Previous' }),
            ).toBeNull();

            await user.click(screen.getByRole('menuitem', { name: 'Reopen' }));

            expect(retroRequest).toHaveBeenLastCalledWith(expect.anything(), {
                phase: 'roti',
            });
        });

        it('gives a participant no phase entry', async () => {
            renderInBoard(
                phoneActions,
                boardContext(
                    retroSnapshot({ viewer: { isFacilitator: false } }),
                ),
            );

            await openMenu('Menu');

            expect(entries()).not.toContain('Next');
            expect(entries()).not.toContain('Previous');
        });
    });

    it('keeps the phase moves out of the menu above the phone', async () => {
        const user = userEvent.setup();

        renderInBoard(actions, boardContext());

        await user.click(
            screen.getByRole('button', { name: 'Facilitator menu' }),
        );

        expect(screen.queryByRole('menuitem', { name: 'Next' })).toBeNull();
    });
});
