import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
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

/** The panel under the settings button of the header, as the board places it. */
function SettingsUnderButton() {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(true);

    return (
        <>
            <button type="button" ref={anchorRef}>
                Settings
            </button>
            <BoardSettings
                open={open}
                onOpenChange={setOpen}
                variant="popover"
                anchorRef={anchorRef}
            />
        </>
    );
}

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
            'retro-cursors',
            'retro-votes-auto',
            'retro-presentation',
        ]) {
            expect(document.getElementById(id), id).not.toBeNull();
        }

        expect(document.getElementById('retro-health-check')).toBeNull();
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

    const openAddSurvey = async () => {
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Add survey' }));

        return user;
    };

    const isDisabled = (name: RegExp) =>
        screen.getByRole('menuitem', { name }).getAttribute('aria-disabled') ===
        'true';

    it('offers "Add survey" to the facilitator, and opens the quick poll dialog in place of the panel', async () => {
        const onOpenChange = vi.fn();

        renderInBoard(
            <BoardSettings
                open
                onOpenChange={onOpenChange}
                variant="popover"
            />,
            boardContext(),
        );

        const user = await openAddSurvey();

        await user.click(screen.getByRole('menuitem', { name: /^Quick poll/ }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(
            await screen.findByRole('dialog', { name: 'New survey' }),
        ).toBeTruthy();
        expect(document.getElementById('survey-question')).not.toBeNull();
    });

    it('gives the keyboard to the settings button when the survey dialog is cancelled', async () => {
        renderInBoard(<SettingsUnderButton />, boardContext());

        const user = await openAddSurvey();

        await user.click(screen.getByRole('menuitem', { name: /^Quick poll/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Settings' }),
            ),
        );
        expect(screen.queryByRole('dialog', { name: 'New survey' })).toBeNull();
    });

    it('attaches the health check, with the number of statements of the team', async () => {
        const { ctx } = renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(),
        );

        const user = await openAddSurvey();

        expect(
            screen.getByRole('menuitem', { name: /^Health check/ }).textContent,
        ).toContain('6 statements');

        await user.click(
            screen.getByRole('menuitem', { name: /^Health check/ }),
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'post',
                    url: expect.stringMatching(
                        /\/retros\/retro-1\/health-check$/,
                    ),
                }),
            ),
        );
        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
    });

    it('says when the health check is already added', async () => {
        renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(
                retroSnapshot({
                    healthCheck: {
                        surveyId: 'survey-1',
                        isClosed: false,
                        scale: 5,
                        respondents: 0,
                        participants: 1,
                        hasSubmitted: false,
                        statements: [],
                        results: null,
                    },
                }),
            ),
        );

        await openAddSurvey();

        expect(isDisabled(/^Health check added/)).toBe(true);
    });

    it.each([
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
    ])(
        'offers the health check and no quick poll with %s',
        async (_, board) => {
            renderInBoard(
                <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
                boardContext(board),
            );

            await openAddSurvey();

            expect(isDisabled(/^Health check/)).toBe(false);
            expect(isDisabled(/^Quick poll/)).toBe(true);
        },
    );

    it.each([
        ['a participant', retroSnapshot({ viewer: { isFacilitator: false } })],
        ['a completed retro', retroSnapshot({ retro: { phase: 'completed' } })],
    ])('does not offer "Add survey" to %s', (_, board) => {
        renderInBoard(
            <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
            boardContext(board),
        );

        expect(screen.queryByRole('button', { name: 'Add survey' })).toBeNull();
    });

    it.each(['writing', 'grouping', 'voting', 'discussing'] as const)(
        'offers the quick poll in %s',
        async (phase) => {
            renderInBoard(
                <BoardSettings open onOpenChange={vi.fn()} variant="popover" />,
                boardContext(retroSnapshot({ retro: { phase } })),
            );

            await openAddSurvey();

            expect(isDisabled(/^Quick poll/)).toBe(false);
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
