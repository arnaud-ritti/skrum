import { TriangleAlert } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { PaletteWarning } from './branding';

export function PaletteWarnings({
    warnings,
    bare = false,
}: {
    warnings: PaletteWarning[];
    /** Inside the colour notice, which already has the surface and the icon. */
    bare?: boolean;
}) {
    const { t } = useTrans();

    if (warnings.length === 0) {
        return null;
    }

    return (
        <ul
            data-slot="palette-warnings"
            className={cn(
                'grid text-body-sm text-skrum-warning-text',
                bare
                    ? 'gap-1 font-semibold'
                    : 'gap-2 rounded-lg bg-skrum-warning-soft p-3',
            )}
        >
            {warnings.map((warning) => (
                <li
                    key={warning.key}
                    className="flex min-w-0 items-start gap-2"
                >
                    {!bare && (
                        <TriangleAlert
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                    )}
                    <span className="min-w-0">
                        {t(warning.key, warning.replace)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
