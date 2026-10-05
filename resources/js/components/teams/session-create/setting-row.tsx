import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type SettingRowProps = {
    label: string;
    htmlFor: string;
    help?: ReactNode;
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
    const describedBy = [
        help === undefined ? undefined : `${htmlFor}-help`,
        error === undefined ? undefined : `${htmlFor}-error`,
    ]
        .filter((id) => id !== undefined)
        .join(' ');

    // Each caller builds its own control (a switch, a select trigger…): the
    // row describes it by its id instead of every caller wiring the ids.
    useEffect(() => {
        const control = document.getElementById(htmlFor);

        if (control === null) {
            return;
        }

        if (describedBy === '') {
            control.removeAttribute('aria-describedby');

            return;
        }

        control.setAttribute('aria-describedby', describedBy);
    });

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
