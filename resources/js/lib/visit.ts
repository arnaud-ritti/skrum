import { router } from '@inertiajs/react';

type VisitErrors = Record<string, string>;

/** Why a visit did not go through; `errors` is empty unless the server refused a field. */
export class VisitError extends Error {
    constructor(public errors: VisitErrors = {}) {
        super(Object.values(errors)[0] ?? 'The visit ended without an answer.');
    }
}

/**
 * An Inertia visit as a promise that always settles: resolved by the
 * redirect, rejected by validation errors or by a visit that ended without
 * one (expired session, refusal, server error, lost network).
 */
export function visitAsPromise(
    method: 'post' | 'delete',
    url: string,
    data?: Record<string, string>,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const options = {
            preserveScroll: true,
            onSuccess: () => resolve(),
            onError: (errors: VisitErrors) => reject(new VisitError(errors)),
            onFinish: () => reject(new VisitError()),
        };

        if (method === 'post') {
            router.post(url, data ?? {}, options);

            return;
        }

        router.delete(url, {
            ...(data === undefined ? {} : { data }),
            ...options,
        });
    });
}

export function deleteVisit(
    url: string,
    data?: Record<string, string>,
): Promise<void> {
    return visitAsPromise('delete', url, data);
}
