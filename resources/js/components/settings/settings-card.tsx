import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SettingsCardBase = {
    title: string;
    description?: string;
    children: ReactNode;
};

/**
 * `destructive`: one tinted card with a warning icon, the title and the
 * consequences on a row; the children are its action. It has no footer,
 * header, action or flush body.
 */
type DestructiveSettingsCardProps = SettingsCardBase & {
    tone: 'destructive';
    footer?: never;
    header?: never;
    action?: never;
    flush?: never;
};

type DefaultSettingsCardProps = SettingsCardBase & {
    tone?: 'default';
    /** Row under the body, on a muted band: a hint and the action of the card. */
    footer?: ReactNode;
    /** Row at the top of the card, above a rule: an icon, a name, a state. */
    header?: ReactNode;
    /** Beside the title, out of the card: the action on the whole card. */
    action?: ReactNode;
    /** The body has no padding and no gap: its children are full-width rows. */
    flush?: boolean;
};

type SettingsCardProps =
    | DefaultSettingsCardProps
    | DestructiveSettingsCardProps;

export function SettingsCard({
    title,
    description,
    footer,
    tone = 'default',
    header,
    action,
    flush = false,
    children,
}: SettingsCardProps): ReactElement {
    const titleId = useId();

    if (tone === 'destructive') {
        return (
            <section
                data-slot="settings-card"
                data-tone="destructive"
                aria-labelledby={titleId}
                className="min-w-0"
            >
                <Card className="border-[color-mix(in_oklch,var(--destructive)_40%,var(--border))]">
                    <div className="flex flex-wrap items-start gap-4 p-5 [&>button]:self-center">
                        <span
                            data-slot="settings-card-icon"
                            className="grid size-10 shrink-0 place-items-center rounded-full bg-skrum-destructive-soft text-skrum-destructive-text"
                        >
                            <TriangleAlert
                                aria-hidden="true"
                                className="size-5"
                            />
                        </span>
                        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                            <h2 id={titleId} className="text-sm font-semibold">
                                {title}
                            </h2>
                            {description !== undefined && (
                                <p className="text-sm text-muted-foreground">
                                    {description}
                                </p>
                            )}
                        </div>
                        {children}
                    </div>
                </Card>
            </section>
        );
    }

    return (
        <section
            data-slot="settings-card"
            data-tone="default"
            aria-labelledby={titleId}
            className="flex min-w-0 flex-col gap-4"
        >
            <div
                data-slot="settings-card-heading"
                className="flex min-w-0 flex-wrap items-end justify-between gap-3"
            >
                <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <h2
                        id={titleId}
                        className="text-xl font-title tracking-heading"
                    >
                        {title}
                    </h2>
                    {description !== undefined && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {action}
            </div>
            <Card>
                {header !== undefined && header !== null && (
                    <div
                        data-slot="settings-card-header"
                        className="flex min-w-0 flex-wrap items-center gap-3 border-b px-5 py-4"
                    >
                        {header}
                    </div>
                )}
                <div
                    data-slot="settings-card-body"
                    className={cn(
                        'flex min-w-0 flex-col',
                        !flush && 'gap-5 p-5',
                    )}
                >
                    {children}
                </div>
                {footer !== undefined && footer !== null && (
                    <div
                        data-slot="settings-card-footer"
                        className="flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t bg-muted/50 px-5 py-3"
                    >
                        {footer}
                    </div>
                )}
            </Card>
        </section>
    );
}
