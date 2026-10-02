import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The outline button that turns a second factor off. */
export const turnOffButtonClass =
    'max-w-full border-[color-mix(in_oklch,var(--destructive)_45%,var(--input))] text-skrum-destructive-text hover:text-skrum-destructive-text';

/** One line of the two-factor card: an icon, a name, its state and its action. */
export function TwoFactorRow({
    icon: Icon,
    destructive = false,
    title,
    description,
    action,
    children,
}: {
    icon: LucideIcon;
    destructive?: boolean;
    title: string;
    description?: string;
    action?: ReactNode;
    children?: ReactNode;
}): ReactElement {
    return (
        <div
            data-slot="two-factor-row"
            className="flex min-w-0 flex-col gap-4 border-b px-5 py-4 last:border-b-0"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
                <Icon
                    aria-hidden="true"
                    className={cn(
                        'size-5 shrink-0',
                        destructive
                            ? 'text-skrum-destructive-text'
                            : 'text-muted-foreground',
                    )}
                />
                <div className="flex min-w-0 flex-1 basis-56 flex-col">
                    <span className="text-sm font-semibold">{title}</span>
                    {description !== undefined && (
                        <span className="text-sm text-muted-foreground">
                            {description}
                        </span>
                    )}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}
