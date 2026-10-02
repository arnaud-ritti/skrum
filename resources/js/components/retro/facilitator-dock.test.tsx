import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    facilitatorActions,
    FacilitatorDock,
    facilitatorPrimary,
} from '@/components/retro/facilitator-dock';
import type { FacilitatorTools } from '@/components/retro/facilitator-dock';
import type { RetroPhase } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

function tools(): FacilitatorTools {
    return { t: (key) => key, onSetting: vi.fn(), onPhase: vi.fn() };
}

const ids = (phase: RetroPhase, retro = {}) =>
    facilitatorActions(
        phase,
        retroSnapshot({ retro: { phase, ...retro } }),
        tools(),
    ).map((action) => action.id);

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
});

describe('facilitatorActions', () => {
    it('offers the lock in every phase before the discussion', () => {
        for (const phase of [
            'health_check',
            'icebreaker',
            'writing',
            'grouping',
        ] as const) {
            expect(ids(phase)).toEqual(['lock']);
        }
    });

    it('adds the vote counts toggle while voting', () => {
        expect(ids('voting')).toEqual(['lock', 'hide-vote-counts']);
    });

    it('offers the presentation mode while discussing', () => {
        expect(ids('discussing')).toEqual(['presentation']);
    });

    it('has nothing once the retro is completed', () => {
        expect(ids('completed')).toEqual([]);
    });

    it('shows the lock as pressed and named after its state', () => {
        const [open] = facilitatorActions('writing', retroSnapshot(), tools());
        const [locked] = facilitatorActions(
            'writing',
            retroSnapshot({ retro: { isLocked: true } }),
            tools(),
        );

        expect(open).toMatchObject({ label: 'Lock board', pressed: false });
        expect(locked).toMatchObject({ label: 'Board locked', pressed: true });
    });

    it('sends the opposite of the current setting', () => {
        const given = tools();
        const [lock, counts] = facilitatorActions(
            'voting',
            retroSnapshot({ retro: { phase: 'voting', hideVoteCounts: true } }),
            given,
        );

        lock.onSelect();
        counts.onSelect();

        expect(given.onSetting).toHaveBeenNthCalledWith(1, { is_locked: true });
        expect(given.onSetting).toHaveBeenNthCalledWith(2, {
            hide_vote_counts: false,
        });
    });
});

describe('facilitatorPrimary', () => {
    it('names the next phase', () => {
        const given = tools();
        const primary = facilitatorPrimary('writing', retroSnapshot(), given);

        expect(primary).toMatchObject({
            id: 'next-phase',
            label: 'Grouping',
            iconPosition: 'end',
        });

        primary?.onSelect();

        expect(given.onPhase).toHaveBeenCalledWith('grouping');
    });

    it('ends the session from the last phase', () => {
        const given = tools();
        const primary = facilitatorPrimary(
            'discussing',
            retroSnapshot({ retro: { phase: 'discussing' } }),
            given,
        );

        expect(primary).toMatchObject({
            id: 'end-session',
            label: 'End session',
        });

        primary?.onSelect();

        expect(given.onPhase).toHaveBeenCalledWith('completed');
    });

    it('is absent once completed', () => {
        expect(
            facilitatorPrimary(
                'completed',
                retroSnapshot({ retro: { phase: 'completed' } }),
                tools(),
            ),
        ).toBeUndefined();
    });
});

describe('FacilitatorDock', () => {
    it('shows the facilitator bar of the phase and moves to the next phase', async () => {
        const { ctx } = renderInBoard(<FacilitatorDock />, boardContext());
        const bar = screen.getByRole('toolbar', { name: 'Facilitation tools' });

        expect(bar.textContent).toContain('Facilitator');

        fireEvent.click(screen.getByRole('button', { name: 'Grouping' }));

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/phase'),
            }),
            { phase: 'grouping' },
        );
    });

    it('locks the board from the bar', async () => {
        renderInBoard(<FacilitatorDock />, boardContext());

        fireEvent.click(screen.getByRole('button', { name: 'Lock board' }));

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('/retros/retro-1/settings'),
                }),
                { is_locked: true },
            ),
        );
    });

    it('says that anonymity is on while an anonymous retro is in Writing, as a state', () => {
        const anonymous = renderInBoard(
            <FacilitatorDock />,
            boardContext(retroSnapshot({ retro: { isAnonymous: true } })),
        );
        const bar = screen.getByRole('toolbar', { name: 'Facilitation tools' });

        expect(bar.textContent).toContain('Anonymity: on');
        expect(
            screen.queryByRole('button', { name: 'Anonymity: on' }),
        ).toBeNull();
        anonymous.unmount();

        const named = renderInBoard(<FacilitatorDock />, boardContext());

        expect(
            screen.getByRole('toolbar', { name: 'Facilitation tools' })
                .textContent,
        ).not.toContain('Anonymity');
        named.unmount();

        renderInBoard(
            <FacilitatorDock />,
            boardContext(
                retroSnapshot({
                    retro: { isAnonymous: true, phase: 'grouping' },
                }),
            ),
        );

        expect(
            screen.getByRole('toolbar', { name: 'Facilitation tools' })
                .textContent,
        ).not.toContain('Anonymity');
    });

    it('has no bar for a participant, nor on a completed retro', () => {
        const participant = renderInBoard(
            <FacilitatorDock />,
            boardContext(retroSnapshot({ viewer: { isFacilitator: false } })),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
        participant.unmount();

        renderInBoard(
            <FacilitatorDock />,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
    });
});
