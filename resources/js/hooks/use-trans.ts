import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';
import { elide } from '@/lib/elision';

type Replacements = Record<string, string | number>;

export type Translate = (key: string, replacements?: Replacements) => string;

export function useTrans() {
    const { translations, locale } = usePage().props;

    const t = useCallback(
        (key: string, replacements: Replacements = {}): string => {
            let line = translations[key] ?? key;

            if (locale?.startsWith('fr')) {
                line = elide(line, replacements);
            }

            for (const [name, value] of Object.entries(replacements).sort(
                ([first], [second]) => second.length - first.length,
            )) {
                line = line.replaceAll(`:${name}`, () => String(value));
            }

            return line;
        },
        [translations, locale],
    );

    return { t };
}
