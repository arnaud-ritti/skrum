import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type SettingRowProps = {
    label: string;
    htmlFor: string;
    help?: string;
    icon?: LucideIcon;
    error?: string;
    children: ReactNode;
};

/**
 * One line of the settings column of the creation dialog: an icon, a label
 * with its help, and the control. The control drops under the label when the
 * column is too narrow for both.
 */
export function SettingRow({
    label,
    htmlFor,
    help,
    icon: Icon,
    error,
    children,
}: SettingRowProps): ReactElement {
    return (
        <div
            data-slot="setting-row"
            className="flex min-h-10 min-w-0 flex-wrap items-start gap-x-3 gap-y-1.5 border-b py-2 last:border-b-0"
        >
            {Icon !== undefined && (
                <Icon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
            )}
            <div className="flex min-w-32 flex-1 flex-col gap-0.5">
                <Label
                    htmlFor={htmlFor}
                    className="block truncate text-body-sm leading-5"
                >
                    {label}
                </Label>
                {help !== undefined && (
                    <p
                        id={`${htmlFor}-help`}
                        className="text-xs text-muted-foreground"
                    >
                        {help}
                    </p>
                )}
                {error !== undefined && (
                    <p
                        id={`${htmlFor}-error`}
                        role="alert"
                        className="text-xs text-skrum-destructive-text"
                    >
                        {error}
                    </p>
                )}
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-2 self-center">
                {children}
            </div>
        </div>
    );
}
