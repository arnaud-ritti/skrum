import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhaseHealth } from '@/components/retro/phase-health';
import type { HealthCheckState, HealthCheckStatement } from '@/lib/retro/types';
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

function health(
    state: Partial<HealthCheckState> = {},
    retro: Parameters<typeof retroSnapshot>[0] = {},
) {
    const board = retroSnapshot({
        ...retro,
        retro: { phase: 'health_check', ...retro.retro },
        healthCheck: {
            surveyId: 'survey-1',
            isClosed: false,
            scale: 5,
            respondents: 0,
            participants: 2,
            hasSubmitted: false,
            statements: [statement(), vision],
            ...state,
        },
    });

    return renderInBoard(<PhaseHealth />, boardContext(board));
}

function score(text: string, value: number): HTMLElement {
    return screen
        .getByRole('radiogroup', { name: text })
        .querySelector(`[aria-label="Score ${value}"]`) as HTMLElement;
}

function submitButton(): HTMLButtonElement {
    return screen.getByRole('button', {
        name: 'Submit answers',
    }) as HTMLButtonElement;
}

describe('PhaseHealth', () => {
    beforeEach(() => {
        retroRequest.mockReset();
    });

    it('says how to answer on the scale of the health check and lists its statements, in their order', () => {
        const { container } = health();

        expect(
            screen.getByText(
                'Rate each statement from 1 (Strongly disagree) to 5 (Strongly agree). Only you see your own scores.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', { name: 'Health check · Sprint 42' }),
        ).toBeTruthy();
        expect(
            [...container.querySelectorAll('ol > li [role="radiogroup"]')].map(
                (group) => group.getAttribute('aria-label'),
            ),
        ).toEqual([Interaction, Vision]);
        expect(
            container.querySelectorAll('ol > li:first-child [role="radio"]'),
        ).toHaveLength(5);
    });

    it('sends nothing per score, and every score at once on "Submit answers"', async () => {
        retroRequest.mockResolvedValue({
            respondents: 1,
            participants: 2,
            hasSubmitted: true,
        });

        const { ctx } = health();

        fireEvent.click(score(Interaction, 4));

        expect(retroRequest).not.toHaveBeenCalled();
        expect(submitButton().disabled).toBe(true);

        fireEvent.click(score(Vision, 2));

        expect(retroRequest).not.toHaveBeenCalled();
        expect(submitButton().disabled).toBe(false);

        fireEvent.click(submitButton());

        await waitFor(() => expect(retroRequest).toHaveBeenCalledTimes(1));
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: expect.stringContaining('/health-check/submission'),
            }),
            { scores: { interaction: 4, vision: 2 } },
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

    it('is read-only once sent', () => {
        const { ctx } = health({
            hasSubmitted: true,
            statements: [statement({ myScore: 4 }), { ...vision, myScore: 2 }],
        });

        expect(screen.getByText('Answers sent. Thank you.')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Submit answers' }),
        ).toBeNull();

        fireEvent.click(score(Vision, 5));

        expect(score(Vision, 2).getAttribute('aria-checked')).toBe('true');
        expect(retroRequest).not.toHaveBeenCalled();
        expect(ctx.apply).not.toHaveBeenCalled();
    });

    it('names nobody and offers no Clear', () => {
        const { container } = health({
            statements: [statement({ myScore: 4 }), vision],
        });

        expect(container.querySelector('ol > li img')).toBeNull();
        expect(
            container.querySelector('[data-slot="health-answered"]'),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /^Clear/ })).toBeNull();
    });

    it('disables every score on a board closed for editing', () => {
        const { container } = health(
            { statements: [statement({ myScore: 3 }), vision] },
            { retro: { isLocked: true } },
        );

        expect(
            container.querySelectorAll('ol > li [role="radio"]:disabled'),
        ).toHaveLength(10);

        fireEvent.click(score(Vision, 2));

        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('keeps the scale of ten of a health check imported open on it', () => {
        const { container } = health({ scale: 10 });

        expect(
            screen.getByText(
                'Rate each statement from 1 (Strongly disagree) to 10 (Strongly agree). Only you see your own scores.',
            ),
        ).toBeTruthy();
        expect(
            container.querySelectorAll('ol > li:first-child [role="radio"]'),
        ).toHaveLength(10);
    });
});
