import { router } from '@inertiajs/react';

type VisitErrors = Record<string, string>;

/** Why a deletion did not go through; `errors` is empty unless the server refused a field. */
export class DeleteVisitError extends Error {
    constructor(public errors: VisitErrors = {}) {
        super(Object.values(errors)[0] ?? 'The visit ended without an answer.');
    }
}

/**
 * An Inertia deletion as a promise that always settles: resolved by the
 * redirect, rejected by validation errors or by a visit that ended without
 * one (expired session, refusal, server error, lost network).
 */
export function deleteVisit(
    url: string,
    data?: Record<string, string>,
): Promise<void> {
    return new Promise((resolve, reject) => {
        router.delete(url, {
            ...(data === undefined ? {} : { data }),
            preserveScroll: true,
            onSuccess: () => resolve(),
            onError: (errors) => reject(new DeleteVisitError(errors)),
            onFinish: () => reject(new DeleteVisitError()),
        });
    });
}
