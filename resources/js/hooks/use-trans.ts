import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

type Replacements = Record<string, string | number>;

export function useTrans() {
    const { translations } = usePage().props;

    const t = useCallback(
        (key: string, replacements: Replacements = {}): string => {
            let line = translations[key] ?? key;

            for (const [name, value] of Object.entries(replacements).sort(
                ([first], [second]) => second.length - first.length,
            )) {
                line = line.replaceAll(`:${name}`, () => String(value));
            }

            return line;
        },
        [translations],
    );

    return { t };
}
