import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardProvider } from '@/components/retro/board-context';
import { useHealthCheckSubmission } from '@/components/retro/use-health-check-submission';
import { RetroRequestError } from '@/lib/retro/api';
import type { HealthCheckState } from '@/lib/retro/types';
import { boardContext, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

function healthCheck(
    overrides: Partial<HealthCheckState> = {},
): HealthCheckState {
    return {
        surveyId: 'survey-1',
        isClosed: false,
        scale: 5,
        respondents: 0,
        participants: 2,
        hasSubmitted: false,
        statements: [
            {
                key: 'interaction',
                label: 'Interaction',
                text: 'Interaction with colleagues was productive',
                isBuiltin: true,
                myScore: null,
            },
            {
                key: 'vision',
                label: 'Vision',
                text: 'The vision and goals are clear to me',
                isBuiltin: true,
                myScore: null,
            },
        ],
        results: null,
        ...overrides,
    };
}

function submission(state: HealthCheckState = healthCheck(), isLocked = false) {
    const ctx = boardContext(
        retroSnapshot({ healthCheck: state, retro: { isLocked } }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
        <BoardProvider value={ctx}>{children}</BoardProvider>
    );

    return {
        ctx,
        ...renderHook(() => useHealthCheckSubmission(), { wrapper }),
    };
}

describe('useHealthCheckSubmission', () => {
    beforeEach(() => {
        retroRequest.mockReset();
    });

    it('sends nothing while a statement has no score', async () => {
        const { result } = submission();

        act(() => result.current.setAnswer('interaction', 4));

        expect(result.current.canSubmit).toBe(false);

        await act(() => result.current.submit());

        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('sends every score at once, then applies the submission', async () => {
        retroRequest.mockResolvedValue({
            respondents: 1,
            participants: 2,
            hasSubmitted: true,
        });

        const { result, ctx } = submission();

        act(() => {
            result.current.setAnswer('interaction', 4);
            result.current.setAnswer('vision', 2);
        });

        expect(result.current.canSubmit).toBe(true);
        expect(retroRequest).not.toHaveBeenCalled();

        await act(() => result.current.submit());

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: expect.stringContaining(
                    '/retros/retro-1/health-check/submission',
                ),
            }),
            { scores: { interaction: 4, vision: 2 } },
        );
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'health.submitted',
            scores: { interaction: 4, vision: 2 },
            respondents: 1,
            participants: 2,
        });
    });

    it('keeps the scores on screen when the server refuses', async () => {
        retroRequest.mockRejectedValue(
            new RetroRequestError(422, 'You have already sent your answers.'),
        );

        const { result, ctx } = submission();

        act(() => {
            result.current.setAnswer('interaction', 3);
            result.current.setAnswer('vision', 5);
        });

        await act(() => result.current.submit());

        expect(ctx.apply).not.toHaveBeenCalled();
        expect(result.current.answers).toEqual({ interaction: 3, vision: 5 });
        expect(result.current.submitting).toBe(false);
    });

    it('starts from the scores already sent, and sends nothing more', () => {
        const { result } = submission(
            healthCheck({
                hasSubmitted: true,
                statements: healthCheck().statements.map((statement) => ({
                    ...statement,
                    myScore: 3,
                })),
            }),
        );

        act(() => result.current.setAnswer('vision', 5));

        expect(result.current.answers).toEqual({ interaction: 3, vision: 3 });
        expect(result.current.canSubmit).toBe(false);
    });

    it('cannot send on a closed health check or a locked board', () => {
        const scored = healthCheck().statements.map((statement) => ({
            ...statement,
            myScore: null,
        }));

        const closed = submission(
            healthCheck({ isClosed: true, statements: scored }),
        );

        act(() => {
            closed.result.current.setAnswer('interaction', 4);
            closed.result.current.setAnswer('vision', 4);
        });

        expect(closed.result.current.canSubmit).toBe(false);

        const locked = submission(healthCheck(), true);

        act(() => {
            locked.result.current.setAnswer('interaction', 4);
            locked.result.current.setAnswer('vision', 4);
        });

        expect(locked.result.current.canSubmit).toBe(false);
    });
});
