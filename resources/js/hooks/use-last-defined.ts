import { useState } from 'react';

/**
 * A visit to the same page drops a deferred prop until it is fetched again.
 * This keeps the last value received, so what it feeds does not fall back to
 * its loading state. `undefined` only before the first answer.
 */
export function useLastDefined<T>(value: T | undefined): T | undefined {
    const [last, setLast] = useState(value);

    if (value !== undefined && value !== last) {
        setLast(value);
    }

    return value === undefined ? last : value;
}
