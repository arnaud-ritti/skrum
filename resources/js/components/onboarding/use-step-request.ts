import type { FormDataConvertible } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { useState } from 'react';

type Method = 'put' | 'post';

export type StepErrors = Record<string, string | undefined>;

/**
 * One onboarding request at a time: which action is under way, and the
 * field errors of the last refusal, shown under their fields.
 */
export function useStepRequest<Action extends string>() {
    const [pending, setPending] = useState<Action | null>(null);
    const [errors, setErrors] = useState<StepErrors>({});

    const send = (
        action: Action,
        method: Method,
        url: string,
        data: Record<string, FormDataConvertible> = {},
    ): void => {
        if (pending !== null) {
            return;
        }

        router[method](url, data, {
            preserveScroll: true,
            onStart: () => setPending(action),
            onSuccess: () => setErrors({}),
            onError: (failures) => setErrors(failures),
            onFinish: () => setPending(null),
        });
    };

    return { pending, busy: pending !== null, errors, send };
}
