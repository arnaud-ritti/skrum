import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    facilitatorActions,
    FacilitatorDock,
    facilitatorPrimary,
} from '@/components/retro/facilitator-dock';
import type { FacilitatorTools } from '@/components/retro/facilitator-dock';
import type { RetroPhase } from '@/lib/retro/types';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
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
        for (const phase of ['icebreaker', 'writing', 'grouping'] as const) {
            expect(ids(phase)).toEqual(['lock']);
        }
    });

    it('adds the reveal of the votes while voting', () => {
        expect(ids('voting')).toEqual(['lock', 'reveal-votes']);
    });

    it('names the reveal after what it does: "Reveal the votes" while they are hidden, "Hide the votes" while they show', () => {
        const reveal = (hideVoteCounts: boolean) =>
            facilitatorActions(
                'voting',
                retroSnapshot({ retro: { phase: 'voting', hideVoteCounts } }),
                tools(),
            )[1];

        expect(reveal(true).label).toBe('Reveal the votes');
        expect(reveal(false).label).toBe('Hide the votes');
        expect(reveal(true).kind).toBeUndefined();
        expect(reveal(true).pressed).toBeUndefined();
    });

    it('offers "Everyone follows" while discussing: the presentation mode of the settings', () => {
        const given = tools();
        const [follow, ...rest] = facilitatorActions(
            'discussing',
            retroSnapshot({ retro: { phase: 'discussing' } }),
            given,
        );

        expect(rest).toEqual([]);
        expect(follow).toMatchObject({
            id: 'presentation',
            label: 'Everyone follows',
            kind: 'toggle',
            pressed: false,
        });

        follow.onSelect();

        expect(given.onSetting).toHaveBeenCalledWith({
            presentation_mode: true,
        });
    });

    it('moves between the topics while discussing, and stops at either end', () => {
        const topics = {
            canPrevious: false,
            canNext: true,
            onStep: vi.fn(),
            onFollow: vi.fn(),
        };
        const [follow, previous, next, ...rest] = facilitatorActions(
            'discussing',
            retroSnapshot({
                retro: { phase: 'discussing', presentationMode: true },
            }),
            { ...tools(), topics },
        );

        expect(rest).toEqual([]);

        expect(previous).toMatchObject({
            id: 'previous-topic',
            label: 'Previous topic',
            disabled: true,
        });
        expect(next).toMatchObject({
            id: 'next-topic',
            label: 'Next topic',
            disabled: false,
        });

        next.onSelect();
        follow.onSelect();

        expect(topics.onStep).toHaveBeenCalledWith(1);
        expect(topics.onFollow).toHaveBeenCalledWith(false);
    });

    it('offers "Next topic" alone in Actions, where the topic in focus is the one of everyone', () => {
        const topics = {
            canPrevious: true,
            canNext: true,
            onStep: vi.fn(),
            onFollow: vi.fn(),
        };
        const [next, ...rest] = facilitatorActions(
            'actions',
            retroSnapshot({ retro: { phase: 'actions' } }),
            { ...tools(), topics },
        );

        expect(rest).toEqual([]);
        expect(next).toMatchObject({ id: 'next-topic', label: 'Next topic' });

        next.onSelect();

        expect(topics.onStep).toHaveBeenCalledWith(1);
        expect(ids('actions')).toEqual([]);
    });

    it('has the lock in the bar while cards are written, grouped and voted, and in the settings alone afterwards', () => {
        for (const phase of ['discussing', 'actions', 'roti'] as const) {
            expect(ids(phase)).not.toContain('lock');
        }
    });

    it('leaves the places of "Nudge" and "Reveal ROTI" in ROTI', () => {
        const place = (id: string) => ({
            id,
            label: id,
            icon: (() => null) as never,
            onSelect: vi.fn(),
        });

        expect(
            facilitatorActions(
                'roti',
                retroSnapshot({ retro: { phase: 'roti' } }),
                {
                    ...tools(),
                    roti: { nudge: place('nudge'), reveal: place('reveal') },
                },
            ).map((action) => action.id),
        ).toEqual(['nudge', 'reveal']);
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

    it('says "Next phase" in Actions, and leads to the ROTI', () => {
        const given = tools();
        const primary = facilitatorPrimary(
            'actions',
            retroSnapshot({ retro: { phase: 'actions' } }),
            given,
        );

        expect(primary).toMatchObject({
            id: 'next-phase',
            label: 'Next phase',
        });

        primary?.onSelect();

        expect(given.onPhase).toHaveBeenCalledWith('roti');
    });

    it('says "Go to the retro" during the icebreaker, and leads to the first phase of the retro', () => {
        const given = tools();
        const primary = facilitatorPrimary(
            'icebreaker',
            retroSnapshot({
                retro: {
                    phase: 'icebreaker',
                    phases: ['icebreaker', 'writing', 'completed'],
                },
            }),
            given,
        );

        expect(primary).toMatchObject({
            id: 'next-phase',
            label: 'Go to the retro',
        });

        primary?.onSelect();

        expect(given.onPhase).toHaveBeenCalledWith('writing');
    });

    it('names Actions as the phase after Discussing', () => {
        expect(
            facilitatorPrimary(
                'discussing',
                retroSnapshot({ retro: { phase: 'discussing' } }),
                tools(),
            ),
        ).toMatchObject({ id: 'next-phase', label: 'Actions' });
    });

    it('ends the session from the last phase', () => {
        const given = tools();
        const primary = facilitatorPrimary(
            'roti',
            retroSnapshot({ retro: { phase: 'roti' } }),
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

    it('says the vote limit in Voting, as a state, and reveals the votes from the bar', async () => {
        const voting = renderInBoard(
            <FacilitatorDock />,
            boardContext(
                retroSnapshot({
                    retro: {
                        phase: 'voting',
                        hideVoteCounts: true,
                        votesPerParticipant: 3,
                    },
                }),
            ),
        );
        const bar = screen.getByRole('toolbar', { name: 'Facilitation tools' });

        expect(
            bar.querySelector('[data-slot="facilitator-vote-limit"]')
                ?.textContent,
        ).toBe('3 votes / person');
        expect(
            screen.queryByRole('button', { name: '3 votes / person' }),
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Reveal the votes' }),
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('/retros/retro-1/settings'),
                }),
                { hide_vote_counts: false },
            ),
        );
        voting.unmount();

        renderInBoard(
            <FacilitatorDock />,
            boardContext(
                retroSnapshot({
                    retro: { phase: 'voting', votesPerParticipant: 1 },
                }),
            ),
        );

        expect(
            screen
                .getByRole('toolbar', { name: 'Facilitation tools' })
                .querySelector('[data-slot="facilitator-vote-limit"]')
                ?.textContent,
        ).toBe('1 vote / person');
        expect(
            screen.getByRole('button', { name: 'Hide the votes' }),
        ).toBeTruthy();
    });

    it('has no vote limit in the bar outside Voting', () => {
        renderInBoard(<FacilitatorDock />, boardContext());

        expect(
            document.querySelector('[data-slot="facilitator-vote-limit"]'),
        ).toBeNull();
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

    it('leaves the reaction bar of the session end to that screen', () => {
        renderInBoard(
            <FacilitatorDock />,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } }), {
                presence: {
                    whisper: vi.fn(),
                    listen: vi.fn(),
                    stopListening: vi.fn(),
                } as never,
            }),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
        expect(
            document.querySelector('[data-slot="facilitator-dock"]'),
        ).toBeNull();
    });
});

describe('FacilitatorDock, the next phase from the keyboard', () => {
    const phaseCalls = () =>
        retroRequest.mock.calls.filter(([route]) =>
            String(route.url).endsWith('/phase'),
        );

    it('moves to the next phase with Ctrl or Cmd and the right arrow, as the main button', async () => {
        const { ctx } = renderInBoard(<FacilitatorDock />, boardContext());

        fireEvent.keyDown(document.body, { key: 'ArrowRight' });

        expect(phaseCalls()).toHaveLength(0);

        fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(phaseCalls()).toHaveLength(1);
        expect(phaseCalls()[0][1]).toEqual({ phase: 'grouping' });
    });

    it('answers while the focus is on the main button, where a plain arrow moves inside the toolbar', async () => {
        const { ctx } = renderInBoard(<FacilitatorDock />, boardContext());
        const primary = screen.getByRole('button', { name: 'Grouping' });

        primary.focus();
        fireEvent.keyDown(primary, { key: 'ArrowRight', metaKey: true });

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(phaseCalls()).toHaveLength(1);
        expect(phaseCalls()[0][1]).toEqual({ phase: 'grouping' });
    });

    it('moves one phase only while the key is held', () => {
        renderInBoard(<FacilitatorDock />, boardContext());

        fireEvent.keyDown(document.body, {
            key: 'ArrowRight',
            metaKey: true,
            repeat: true,
        });

        expect(phaseCalls()).toHaveLength(0);
    });

    it('still answers while single-key shortcuts are off, and shows its key on the button', async () => {
        renderInBoard(<FacilitatorDock />, boardContext());

        expect(
            screen
                .getByRole('button', { name: 'Grouping' })
                .getAttribute('aria-keyshortcuts'),
        ).toMatch(/^(Meta|Control)\+ArrowRight$/);
        expect(
            screen.getByRole('button', { name: 'Grouping' }).textContent,
        ).not.toContain('ArrowRight');

        setSingleKeyShortcuts(false);
        fireEvent.keyDown(document.body, { key: 'ArrowRight', ctrlKey: true });
        setSingleKeyShortcuts(true);

        await waitFor(() => expect(phaseCalls()).toHaveLength(1));
    });

    it('does nothing in a field, for a participant, or on a completed retro', () => {
        const facilitator = renderInBoard(
            <>
                <input aria-label="field" />
                <FacilitatorDock />
            </>,
            boardContext(),
        );

        fireEvent.keyDown(screen.getByLabelText('field'), {
            key: 'ArrowRight',
            metaKey: true,
        });
        facilitator.unmount();

        const participant = renderInBoard(
            <FacilitatorDock />,
            boardContext(retroSnapshot({ viewer: { isFacilitator: false } })),
        );

        fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
        participant.unmount();

        renderInBoard(
            <FacilitatorDock />,
            boardContext(retroSnapshot({ retro: { phase: 'completed' } })),
        );

        fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });

        expect(phaseCalls()).toHaveLength(0);
    });
});
