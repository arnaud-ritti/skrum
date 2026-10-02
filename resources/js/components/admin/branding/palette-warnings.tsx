import { TriangleAlert } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { PaletteWarning } from './branding';

export function PaletteWarnings({ warnings }: { warnings: PaletteWarning[] }) {
    const { t } = useTrans();

    if (warnings.length === 0) {
        return null;
    }

    return (
        <ul
            data-slot="palette-warnings"
            className="grid gap-2 rounded-lg bg-skrum-warning-soft p-3 text-body-sm text-skrum-warning-text"
        >
            {warnings.map((warning) => (
                <li
                    key={warning.key}
                    className="flex min-w-0 items-start gap-2"
                >
                    <TriangleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">
                        {t(warning.key, warning.replace)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
