import { usePage } from '@inertiajs/react';

type Replacements = Record<string, string | number>;

export function useTrans() {
    const { translations } = usePage().props;

    const t = (key: string, replacements: Replacements = {}): string => {
        let line = translations[key] ?? key;

        for (const [name, value] of Object.entries(replacements)) {
            line = line.replaceAll(`:${name}`, String(value));
        }

        return line;
    };

    return { t };
}
