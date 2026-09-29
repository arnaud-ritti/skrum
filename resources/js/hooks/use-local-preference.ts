import { useCallback, useState } from 'react';

export function useLocalPreference(
    key: string,
    initial: boolean,
): [boolean, (value: boolean) => void] {
    const [value, setValue] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return initial;
        }

        try {
            const stored = window.localStorage.getItem(key);

            return stored === null ? initial : stored === 'true';
        } catch {
            return initial;
        }
    });

    const update = useCallback(
        (next: boolean) => {
            try {
                window.localStorage.setItem(key, String(next));
            } catch {
                // Storage can be full or disabled; keep the choice for this page only.
            }

            setValue(next);
        },
        [key],
    );

    return [value, update];
}
