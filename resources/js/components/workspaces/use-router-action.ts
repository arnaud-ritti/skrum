import { useCallback, useState } from 'react';
import { useTrans } from '@/hooks/use-trans';

export type RouterActionOptions = {
    preserveScroll: boolean;
    onSuccess: () => void;
    onError: (errors: Record<string, string>) => void;
    onFinish: () => void;
};

/**
 * An Inertia visit as a promise, for the dialogs that close when their action
 * resolves: resolved by the redirect, rejected by validation errors or by a
 * visit that ended without an answer. `error` is the message to show.
 */
export function useRouterAction(): {
    run: (visit: (options: RouterActionOptions) => void) => Promise<void>;
    error?: string;
    reset: () => void;
} {
    const { t } = useTrans();
    const [error, setError] = useState<string>();

    const run = useCallback(
        (visit: (options: RouterActionOptions) => void) =>
            new Promise<void>((resolve, reject) => {
                let settled = false;

                const fail = (message: string): void => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    setError(message);
                    reject(new Error(message));
                };

                setError(undefined);

                visit({
                    preserveScroll: true,
                    onSuccess: () => {
                        settled = true;
                        resolve();
                    },
                    onError: (errors) =>
                        fail(
                            Object.values(errors)[0] ??
                                t('Something went wrong. Please try again.'),
                        ),
                    onFinish: () =>
                        fail(t('Something went wrong. Please try again.')),
                });
            }),
        [t],
    );

    const reset = useCallback(() => setError(undefined), []);

    return { run, error, reset };
}
