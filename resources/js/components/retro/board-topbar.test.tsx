import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BoardActions,
    BoardPhases,
    BoardTimer,
    BoardTitle,
} from '@/components/retro/board-topbar';
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
});

describe('BoardPhases', () => {
    it('lists the phases without the completed state and marks the current one', () => {
        renderInBoard(<BoardPhases />, boardContext());

        const rail = screen.getByRole('list', { name: 'Phases' });
        const steps = [
            ...rail.querySelectorAll('[data-slot="phase-step"]'),
        ].map((step) => step.querySelector('.truncate')?.textContent);

        expect(steps).toEqual(['Writing', 'Grouping', 'Voting', 'Discussing']);
        expect(
            rail.querySelector('[aria-current="step"]')?.textContent,
        ).toContain('Writing');
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
            boardContext(retroSnapshot({ retro: { phase: 'discussing' } })),
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
            phase: 'discussing',
        });
        expect(
            document.querySelector('[aria-current="step"]')?.textContent,
        ).toContain('Completed');
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
});
