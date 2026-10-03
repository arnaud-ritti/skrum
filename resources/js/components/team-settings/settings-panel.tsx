import { useId } from 'react';
import type { ReactElement, ReactNode, Ref } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SettingsPanelProps = {
    id?: string;
    title: ReactNode;
    /** Muted line under the title. */
    subtitle?: ReactNode;
    /** Buttons at the end of the header row. */
    actions?: ReactNode;
    /** Grey band under the body. */
    footer?: ReactNode;
    /** The body has no padding: a table or full-width rows. */
    flush?: boolean;
    className?: string;
    /** The heading takes the focus back when what had it leaves the card. */
    headingRef?: Ref<HTMLHeadingElement>;
    children: ReactNode;
};

/**
 * A card of the team settings as ScreenSettings frame a draws them
 * (`st-card`): the title in a header row above a rule, the body, a grey
 * footer.
 */
export function SettingsPanel({
    id,
    title,
    subtitle,
    actions,
    footer,
    flush = false,
    className,
    headingRef,
    children,
}: SettingsPanelProps): ReactElement {
    const headingId = useId();

    return (
        <Card asChild>
            <section
                id={id}
                aria-labelledby={headingId}
                className={cn('min-w-0 scroll-mt-20', className)}
            >
                <div
                    data-slot="settings-panel-header"
                    className="flex min-w-0 flex-wrap items-center gap-3 border-b px-5 py-4"
                >
                    <div className="flex min-w-32 flex-1 flex-col">
                        <h2
                            id={headingId}
                            ref={headingRef}
                            tabIndex={-1}
                            className="rounded-sm text-base font-semibold wrap-anywhere outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            {title}
                        </h2>
                        {subtitle !== undefined && (
                            <p
                                data-slot="settings-panel-subtitle"
                                className="text-xs text-muted-foreground"
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {actions}
                </div>
                <div
                    data-slot="settings-panel-body"
                    className={cn(
                        'flex min-w-0 flex-col',
                        !flush && 'gap-4 p-5',
                    )}
                >
                    {children}
                </div>
                {footer !== undefined && footer !== null && (
                    <div
                        data-slot="settings-panel-footer"
                        className="flex min-w-0 flex-wrap items-center gap-3 rounded-b-xl border-t bg-muted/50 px-5 py-3"
                    >
                        {footer}
                    </div>
                )}
            </section>
        </Card>
    );
}
