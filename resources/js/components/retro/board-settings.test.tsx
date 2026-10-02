import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BoardSettings,
    retroSettingsValues,
} from '@/components/retro/board-settings';
import { RetroRequestError } from '@/lib/retro/api';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
});

describe('retroSettingsValues', () => {
    it('maps the retro to the fields of the settings endpoint', () => {
        const values = retroSettingsValues(
            retroSnapshot({
                retro: {
                    isLocked: true,
                    votesAuto: false,
                    votesPerParticipant: 7,
                },
            }).retro,
        );

        expect(values).toMatchObject({
            title: 'Sprint 42',
            is_locked: true,
            votes_per_participant: 7,
            reactions_enabled: true,
        });
    });

    it('sends no vote limit when it is automatic', () => {
        expect(
            retroSettingsValues(retroSnapshot().retro).votes_per_participant,
        ).toBeNull();
    });
});

describe('BoardSettings', () => {
    it('is a dialog named "Retrospective settings" with the ids the walkthroughs bind', () => {
        renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(),
        );

        expect(
            screen.getByRole('dialog', { name: 'Retrospective settings' }),
        ).toBeTruthy();

        for (const id of [
            'retro-locked',
            'retro-icebreaker',
            'retro-reactions',
            'retro-hide-vote-counts',
            'retro-health-check',
            'retro-cursors',
            'retro-votes-auto',
            'retro-presentation',
        ]) {
            expect(document.getElementById(id), id).not.toBeNull();
        }
    });

    it('sends only what changed, then refetches the board', async () => {
        const { ctx } = renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(),
        );

        fireEvent.click(document.getElementById('retro-locked') as HTMLElement);
        fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/settings'),
            }),
            { is_locked: true },
        );
    });

    it('shows a refused field under its control and keeps the draft', async () => {
        retroRequest.mockRejectedValue(
            new RetroRequestError(422, 'The title is too long.', {
                title: ['The title is too long.'],
            }),
        );

        const { ctx } = renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(),
        );

        fireEvent.change(
            document.getElementById('retro-title') as HTMLElement,
            {
                target: { value: 'Another title' },
            },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));

        expect(await screen.findByText('The title is too long.')).toBeTruthy();
        expect(ctx.refetch).not.toHaveBeenCalled();
        expect(
            (document.getElementById('retro-title') as HTMLInputElement).value,
        ).toBe('Another title');
    });

    it('closes when the session has expired', async () => {
        retroRequest.mockRejectedValue(new RetroRequestError(401, 'expired'));

        const onOpenChange = vi.fn();

        renderInBoard(
            <BoardSettings
                open
                onOpenChange={onOpenChange}
                variant="popover"
            />,
            boardContext(retroSnapshot(), { handleError: () => null }),
        );

        fireEvent.click(document.getElementById('retro-locked') as HTMLElement);
        fireEvent.click(screen.getByRole('button', { name: 'Apply (1)' }));

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('offers "Add survey" to the facilitator, and opens the survey dialog in place of the panel', () => {
        const onOpenChange = vi.fn();

        renderInBoard(
            <BoardSettings
                open
                onOpenChange={onOpenChange}
                variant="popover"
            />,
            boardContext(),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add survey' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.getByRole('dialog', { name: 'New survey' })).toBeTruthy();
        expect(document.getElementById('survey-question')).not.toBeNull();
    });

    it.each([
        ['a participant', retroSnapshot({ viewer: { isFacilitator: false } })],
        ['the actions phase', retroSnapshot({ retro: { phase: 'actions' } })],
        ['a locked board', retroSnapshot({ retro: { isLocked: true } })],
        [
            'ten surveys',
            retroSnapshot({
                surveys: Array.from({ length: 10 }, (_, index) => ({
                    id: `survey-${index}`,
                })) as never,
            }),
        ],
    ])('does not offer "Add survey" with %s', (_, board) => {
        renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(board),
        );

        expect(screen.queryByRole('button', { name: 'Add survey' })).toBeNull();
    });

    it.each(['writing', 'grouping', 'voting', 'discussing'] as const)(
        'offers "Add survey" in %s',
        (phase) => {
            renderInBoard(
                <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
                boardContext(retroSnapshot({ retro: { phase } })),
            );

            expect(
                screen.getByRole('button', { name: 'Add survey' }),
            ).toBeTruthy();
        },
    );

    it('is read-only for a participant and names the facilitator', () => {
        renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(
                retroSnapshot({
                    viewer: { isFacilitator: false, participantId: 'bob' },
                    participants: [
                        {
                            id: 'me',
                            name: 'Alice Martin',
                            avatarUrl: '/a.svg',
                            isGuest: false,
                        },
                    ],
                }),
            ),
        );

        expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.getByRole('dialog').textContent).toContain(
            'Alice Martin',
        );
    });
});
