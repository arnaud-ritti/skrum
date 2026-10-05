import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthCheckDialog } from '@/components/retro/health-check-dialog';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import type {
    HealthCheckState,
    HealthCheckStatement,
    HealthResults,
} from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

const Interaction = 'Interaction with colleagues was productive';
const Vision = 'The vision and goals are clear to me';

function statement(
    overrides: Partial<HealthCheckStatement> = {},
): HealthCheckStatement {
    return {
        key: 'interaction',
        label: 'Interaction',
        text: Interaction,
        isBuiltin: true,
        myScore: null,
        ...overrides,
    };
}

const vision = statement({ key: 'vision', label: 'Vision', text: Vision });

const results: HealthResults = {
    statements: [
        {
            key: 'interaction',
            label: 'Interaction',
            text: Interaction,
            isBuiltin: true,
            average: 4,
            count: 2,
            previousAverage: null,
            distribution: [0, 0, 0, 2, 0],
        },
        {
            key: 'vision',
            label: 'Vision',
            text: Vision,
            isBuiltin: true,
            average: 2.5,
            count: 2,
            previousAverage: null,
            distribution: [0, 1, 1, 0, 0],
        },
    ],
    score: 3.3,
    participation: { respondents: 2, participants: 3 },
    topStrength: { key: 'interaction', label: 'Interaction', average: 4 },
    growthArea: { key: 'vision', label: 'Vision', average: 2.5 },
    alignment: { value: 8, level: 'high', label: 'High team consensus' },
    assessment: { band: 'good', title: 'Good', sentence: 'Keep going.' },
};

type Options = {
    state?: Partial<HealthCheckState>;
    retro?: Parameters<typeof retroSnapshot>[0];
    onOpenChange?: (open: boolean) => void;
};

function show({
    state = {},
    retro = {},
    onOpenChange = vi.fn(),
}: Options = {}) {
    const board = retroSnapshot({
        ...retro,
        healthCheck: {
            surveyId: 'survey-1',
            isClosed: false,
            scale: 5,
            respondents: 0,
            participants: 2,
            hasSubmitted: false,
            statements: [statement(), vision],
            results: null,
            ...state,
        },
    });

    return {
        onOpenChange,
        ...renderInBoard(
            <HealthCheckDialog open onOpenChange={onOpenChange} />,
            boardContext(board),
        ),
    };
}

function dialog(): HTMLElement {
    return screen.getByRole('dialog', { name: 'Health check · Sprint 42' });
}

function score(text: string, value: number): HTMLElement {
    return screen
        .getByRole('radiogroup', { name: text })
        .querySelector(`[aria-label="Score ${value}"]`) as HTMLElement;
}

async function confirm(trigger: string, confirmLabel: string) {
    await userEvent.click(screen.getByRole('button', { name: trigger }));

    const alert = await screen.findByRole('alertdialog', {
        name: new RegExp(`^${trigger}`),
    });

    await userEvent.click(
        within(alert).getByRole('button', { name: confirmLabel }),
    );

    return alert;
}

describe('HealthCheckDialog', () => {
    beforeEach(() => {
        retroRequest.mockReset();
        retroRequest.mockResolvedValue(null);
    });

    it('holds the form on the scale of the health check while it is open', () => {
        show();

        expect(dialog()).toBeTruthy();
        expect(
            within(dialog())
                .getAllByRole('radiogroup')
                .map((group) => group.getAttribute('aria-label')),
        ).toEqual([Interaction, Vision]);
        expect(
            within(screen.getByRole('radiogroup', { name: Interaction }))
                .getAllByRole('radio')
                .map((radio) => radio.getAttribute('aria-label')),
        ).toEqual(['Score 1', 'Score 2', 'Score 3', 'Score 4', 'Score 5']);
        expect(
            screen.getByRole('button', { name: 'Submit answers' }),
        ).toBeTruthy();
    });

    it('sends every score at once with "Submit answers"', async () => {
        retroRequest.mockResolvedValue({
            respondents: 1,
            participants: 2,
            hasSubmitted: true,
        });

        const { ctx } = show();

        fireEvent.click(score(Interaction, 4));
        fireEvent.click(score(Vision, 2));

        expect(retroRequest).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'post',
                    url: expect.stringContaining('/health-check/submission'),
                }),
                { scores: { interaction: 4, vision: 2 } },
            ),
        );
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'health.submitted',
                scores: { interaction: 4, vision: 2 },
                respondents: 1,
                participants: 2,
            }),
        );
    });

    it('keeps the unsent scores when the dialog is closed and opened again', async () => {
        function Harness() {
            const [open, setOpen] = useState(true);

            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open again
                    </button>
                    <HealthCheckDialog open={open} onOpenChange={setOpen} />
                </>
            );
        }

        renderInBoard(
            <Harness />,
            boardContext(
                retroSnapshot({
                    healthCheck: {
                        surveyId: 'survey-1',
                        isClosed: false,
                        scale: 5,
                        respondents: 0,
                        participants: 2,
                        hasSubmitted: false,
                        statements: [statement(), vision],
                        results: null,
                    },
                }),
            ),
        );

        fireEvent.click(score(Interaction, 4));
        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        await userEvent.click(
            screen.getByRole('button', { name: 'Open again' }),
        );

        expect(score(Interaction, 4).getAttribute('aria-checked')).toBe('true');
        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('is read-only once sent, names nobody and offers no Clear', () => {
        show({
            state: {
                hasSubmitted: true,
                respondents: 1,
                statements: [
                    statement({ myScore: 4 }),
                    { ...vision, myScore: 2 },
                ],
            },
        });

        expect(screen.getByText('Answers sent. Thank you.')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Submit answers' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /^Clear/ })).toBeNull();
        expect(dialog().querySelector('ol img')).toBeNull();

        fireEvent.click(score(Vision, 5));

        expect(score(Vision, 2).getAttribute('aria-checked')).toBe('true');
        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('disables the form on a board closed for editing, and says why', () => {
        show({ retro: { retro: { isLocked: true } } });

        expect(
            screen.getByText('The board is closed for editing.'),
        ).toBeTruthy();
        expect(
            dialog().querySelectorAll('ol [role="radio"]:disabled'),
        ).toHaveLength(10);
    });

    it('keeps the scale of ten of a health check imported open on it', () => {
        show({ state: { scale: 10 } });

        expect(
            within(
                screen.getByRole('radiogroup', { name: Interaction }),
            ).getAllByRole('radio'),
        ).toHaveLength(10);
    });

    it('shows the results once closed, with "Details"', () => {
        show({ state: { isClosed: true, respondents: 2, results } });

        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(
            dialog().querySelector('[data-statement-key="vision"]'),
        ).not.toBeNull();
        expect(
            within(dialog()).getByRole('button', { name: 'Details' }),
        ).toBeTruthy();
    });

    it('says "No answers." for a closed health check nobody answered', () => {
        show({ state: { isClosed: true } });

        expect(within(dialog()).getByText('No answers.')).toBeTruthy();
    });

    it('lets the facilitator close it, after a warning, and stays open for the results', async () => {
        const { ctx, onOpenChange } = show({ state: { respondents: 1 } });

        const alert = await confirm(
            'Close the health check',
            'Close the health check',
        );

        expect(alert.textContent).toContain('Everyone will see the results.');
        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'put',
                    url: expect.stringContaining(
                        '/retros/retro-1/health-check/closure',
                    ),
                }),
            ),
        );
        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('lets the facilitator reopen a closed health check', async () => {
        const { ctx } = show({ state: { isClosed: true, results } });

        expect(
            screen.queryByRole('button', { name: 'Close the health check' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'delete',
                    url: expect.stringContaining(
                        '/retros/retro-1/health-check/closure',
                    ),
                }),
            ),
        );
        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
    });

    it('removes it after saying what becomes of its answers, and closes', async () => {
        const { ctx, onOpenChange } = show({ state: { respondents: 1 } });

        const alert = await confirm('Remove', 'Remove');

        expect(alert.textContent).toContain(
            'Any answers it holds are kept and come back if you add it again.',
        );
        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'delete',
                    url: expect.stringMatching(
                        /\/retros\/retro-1\/health-check$/,
                    ),
                }),
            ),
        );
        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('says the same true thing whether or not anyone has answered yet', async () => {
        show();

        await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

        expect(
            (await screen.findByRole('alertdialog', { name: /^Remove/ }))
                .textContent,
        ).toContain(
            'Any answers it holds are kept and come back if you add it again.',
        );
    });

    it('gives a participant no facilitator action', () => {
        show({ retro: { viewer: { isFacilitator: false } } });

        expect(
            screen.queryByRole('button', { name: 'Close the health check' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    });

    it('sends a digit to the focused statement, not to the reactions', () => {
        const onReact = vi.fn();
        const board = retroSnapshot({
            healthCheck: {
                surveyId: 'survey-1',
                isClosed: false,
                scale: 5,
                respondents: 0,
                participants: 2,
                hasSubmitted: false,
                statements: [statement(), vision],
                results: null,
            },
        });

        renderInBoard(
            <>
                <ReactionBar onReact={onReact} shortcuts />
                <HealthCheckDialog open onOpenChange={vi.fn()} />
            </>,
            boardContext(board),
        );

        const first = score(Interaction, 1);

        first.focus();
        fireEvent.keyDown(first, { key: '3' });

        expect(score(Interaction, 3).getAttribute('aria-checked')).toBe('true');
        expect(onReact).not.toHaveBeenCalled();
    });
});
