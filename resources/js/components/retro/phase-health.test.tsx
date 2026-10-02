import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhaseHealth } from '@/components/retro/phase-health';
import type { HealthCheckStatement } from '@/lib/retro/types';
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
        count: 0,
        answeredBy: [],
        myScore: null,
        ...overrides,
    };
}

const vision = statement({ key: 'vision', label: 'Vision', text: Vision });

function health(
    statements: HealthCheckStatement[] = [statement(), vision],
    retro: Parameters<typeof retroSnapshot>[0] = {},
) {
    const board = retroSnapshot({
        ...retro,
        retro: { phase: 'health_check', ...retro.retro },
        healthCheck: { statements },
    });

    return renderInBoard(<PhaseHealth />, boardContext(board));
}

function score(text: string, value: number): HTMLElement {
    return screen
        .getByRole('radiogroup', { name: text })
        .querySelector(`[aria-label="Score ${value}"]`) as HTMLElement;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });

    return { promise, resolve, reject };
}

describe('PhaseHealth', () => {
    beforeEach(() => {
        retroRequest.mockReset();
    });

    it('says how to answer and lists the statements of the retro, in their order', () => {
        const { container } = health();

        expect(
            screen.getByText(
                'Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores.',
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
            screen.queryByRole('button', { name: 'Submit answers' }),
        ).toBeNull();
    });

    it('saves a score at once, then takes the progress the server answers', async () => {
        const progress = [
            { key: 'interaction', count: 1, answeredBy: ['me'] },
            { key: 'vision', count: 0, answeredBy: [] },
        ];
        retroRequest.mockResolvedValue({ statements: progress });

        const { ctx } = health();

        fireEvent.click(score(Interaction, 7));

        expect(ctx.dispatch).toHaveBeenCalledWith({
            type: 'health.answer',
            key: 'interaction',
            score: 7,
        });
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'put',
                url: expect.stringContaining(
                    '/retros/retro-1/health-check/interaction',
                ),
            }),
            { score: 7 },
        );
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'health.progress',
                statements: progress,
            }),
        );
    });

    it('removes the own answer with Clear', async () => {
        retroRequest.mockResolvedValue({ statements: [] });

        const { ctx } = health([
            statement({ myScore: 5, count: 1, answeredBy: ['me'] }),
            vision,
        ]);

        expect(
            screen.queryByRole('button', { name: 'Clear: Vision' }),
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Clear: Interaction' }),
        );

        expect(ctx.dispatch).toHaveBeenCalledWith({
            type: 'health.answer',
            key: 'interaction',
            score: null,
        });
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'delete' }),
            undefined,
        );
        await waitFor(() => expect(ctx.apply).toHaveBeenCalled());
    });

    it('sends one request at a time per statement and ends on the last score chosen', async () => {
        const first = deferred<{ statements: never[] }>();
        retroRequest
            .mockReturnValueOnce(first.promise)
            .mockResolvedValue({ statements: [] });

        const { ctx } = health();

        fireEvent.click(score(Interaction, 3));
        fireEvent.click(score(Interaction, 4));
        fireEvent.click(score(Interaction, 5));
        fireEvent.click(score(Vision, 9));

        expect(retroRequest).toHaveBeenCalledTimes(2);
        expect(ctx.dispatch).toHaveBeenLastCalledWith({
            type: 'health.answer',
            key: 'vision',
            score: 9,
        });
        expect(ctx.dispatch).toHaveBeenCalledWith({
            type: 'health.answer',
            key: 'interaction',
            score: 5,
        });

        first.resolve({ statements: [] });

        await waitFor(() => expect(retroRequest).toHaveBeenCalledTimes(3));
        expect(retroRequest).toHaveBeenLastCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/health-check/interaction'),
            }),
            { score: 5 },
        );
    });

    it('drops what was waiting when the server refuses', async () => {
        const first = deferred<never>();
        retroRequest.mockReturnValueOnce(first.promise);

        const { ctx } = health();

        fireEvent.click(score(Interaction, 3));
        fireEvent.click(score(Interaction, 4));
        first.reject(new Error('The board is closed for editing.'));

        await waitFor(() => expect(retroRequest).toHaveBeenCalledTimes(1));
        await new Promise((done) => setTimeout(done, 0));

        retroRequest.mockResolvedValue({ statements: [] });
        fireEvent.click(score(Interaction, 8));

        await waitFor(() => expect(ctx.apply).toHaveBeenCalledTimes(1));
        expect(retroRequest).toHaveBeenCalledTimes(2);
        expect(retroRequest).toHaveBeenLastCalledWith(expect.anything(), {
            score: 8,
        });
    });

    it('shows who answered with their picture, and nobody on an anonymous retro', () => {
        const { container, unmount } = health([
            statement({ count: 1, answeredBy: ['me'] }),
        ]);

        expect(screen.getByText('1 answered')).toBeTruthy();
        expect(
            container.querySelector('ol > li img[alt="Alice Martin"]'),
        ).not.toBeNull();
        expect(container.querySelector('[aria-label="Answered"]')).toBeNull();

        unmount();

        const anonymous = health([statement({ count: 1, answeredBy: [] })], {
            retro: { isAnonymous: true },
        });

        expect(screen.getByText('1 answered')).toBeTruthy();
        expect(anonymous.container.querySelector('ol > li img')).toBeNull();
    });

    it('disables every score on a board closed for editing', () => {
        const { container, ctx } = health(
            [statement({ myScore: 6, count: 1, answeredBy: ['me'] }), vision],
            { retro: { isLocked: true } },
        );

        expect(
            container.querySelectorAll('ol > li [role="radio"]:disabled'),
        ).toHaveLength(20);
        expect(screen.queryByRole('button', { name: /^Clear/ })).toBeNull();

        fireEvent.click(score(Vision, 2));

        expect(ctx.dispatch).not.toHaveBeenCalled();
        expect(retroRequest).not.toHaveBeenCalled();
    });
});
