import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import type { RouterActionOptions } from '@/components/workspaces/use-router-action';

function start() {
    const hook = renderHook(() => useRouterAction());
    let options!: RouterActionOptions;
    let outcome = 'pending';
    let promise!: Promise<void>;

    act(() => {
        promise = hook.result.current
            .run((given) => {
                options = given;
            })
            .then(
                () => {
                    outcome = 'resolved';
                },
                () => {
                    outcome = 'rejected';
                },
            );
    });

    return {
        hook,
        options,
        settle: async (finish: () => void) => {
            await act(async () => {
                finish();
                await promise;
            });

            return outcome;
        },
    };
}

describe('useRouterAction', () => {
    it('keeps the scroll position of the page', () => {
        expect(start().options.preserveScroll).toBe(true);
    });

    it('resolves on success and shows no error, even once the visit finishes', async () => {
        const { hook, options, settle } = start();

        const outcome = await settle(() => {
            options.onSuccess();
            options.onFinish();
        });

        expect(outcome).toBe('resolved');
        expect(hook.result.current.error).toBeUndefined();
    });

    it('rejects with the first validation message', async () => {
        const { hook, options, settle } = start();

        const outcome = await settle(() => {
            options.onError({
                member: 'A workspace needs at least one owner.',
            });
            options.onFinish();
        });

        expect(outcome).toBe('rejected');
        expect(hook.result.current.error).toBe(
            'A workspace needs at least one owner.',
        );
    });

    it('rejects with a general message when the visit ends without an answer', async () => {
        const { hook, options, settle } = start();

        const outcome = await settle(() => options.onFinish());

        expect(outcome).toBe('rejected');
        expect(hook.result.current.error).toBe(
            'Something went wrong. Please try again.',
        );
    });

    it('forgets the error on reset', async () => {
        const { hook, options, settle } = start();

        await settle(() => options.onError({ name: 'Taken.' }));
        expect(hook.result.current.error).toBe('Taken.');

        act(() => hook.result.current.reset());
        expect(hook.result.current.error).toBeUndefined();
    });

    it('forgets the error when it runs again', async () => {
        const { hook, options, settle } = start();

        await settle(() => options.onError({ name: 'Taken.' }));
        expect(hook.result.current.error).toBe('Taken.');

        act(() => {
            hook.result.current.run(() => {}).catch(() => {});
        });
        expect(hook.result.current.error).toBeUndefined();
    });
});
