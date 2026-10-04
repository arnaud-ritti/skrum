import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Asks for an optional Inertia prop while it is `missing`. `failed` once a
 * reload ended without it (lost network, cancelled visit); `retry` asks again.
 */
export function useOptionalProp(
    prop: string,
    missing: boolean,
): { failed: boolean; retry: () => void } {
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!missing) {
            return;
        }

        let loaded = false;

        router.reload({
            only: [prop],
            onSuccess: () => {
                loaded = true;
            },
            onFinish: () => {
                if (!loaded) {
                    setFailed(true);
                }
            },
        });
    }, [prop, missing, attempt]);

    return {
        failed: missing && failed,
        retry: () => {
            setFailed(false);
            setAttempt((current) => current + 1);
        },
    };
}
