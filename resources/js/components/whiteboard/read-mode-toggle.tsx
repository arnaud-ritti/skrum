import { Eye, Pencil } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type ReadModeToggleProps = {
    reading: boolean;
    onChange: (reading: boolean) => void;
};

/**
 * "Edit" while reading, "Read" while editing. The label names the action, so
 * the button has no pressed state: the mode itself is said by ReadModeLayer.
 * Hidden when the viewer cannot edit anyway.
 */
export function ReadModeToggle({
    reading,
    onChange,
}: ReadModeToggleProps): ReactElement {
    const { t } = useTrans();

    return (
        <Button
            type="button"
            data-slot="read-mode-toggle"
            variant={reading ? 'default' : 'outline'}
            onClick={() => onChange(!reading)}
            className="pointer-events-auto h-11 max-w-full shrink-0 rounded-full shadow-raised"
        >
            {reading ? <Pencil aria-hidden /> : <Eye aria-hidden />}
            <span className="truncate">{reading ? t('Edit') : t('Read')}</span>
        </Button>
    );
}

export type ReadModeLayerProps = ReadModeToggleProps & {
    /** Place left for the "Follow :name" pill of the phone (roadmap WB-3). */
    follow?: ReactNode;
    /** Place left for the phone tools before the toggle: fit to screen, comments (roadmap WB-1, WB-2). */
    tools?: ReactNode;
};

/**
 * What the phone adds over the canvas: the "Reading" state at the top while
 * reading, and the toggle in the bottom dock, beside the reactions. The state
 * is a polite region that stays mounted, so a change of mode is announced; it
 * is a span, the board's notices being the `div[role="status"]`. The rules
 * that place the dock against the canvas's own bottom bar are in app.css.
 */
export function ReadModeLayer({
    reading,
    onChange,
    follow,
    tools,
}: ReadModeLayerProps) {
    const { t } = useTrans();

    return (
        <>
            <div
                data-slot="read-mode-top"
                className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2"
            >
                <span role="status" className="flex min-w-0">
                    {reading ? (
                        <span
                            data-slot="read-mode-state"
                            className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-border bg-popover px-3 text-sm font-semibold text-popover-foreground shadow-card"
                        >
                            <Eye className="size-4 shrink-0" aria-hidden />
                            <span className="truncate">{t('Reading')}</span>
                        </span>
                    ) : (
                        <span className="sr-only">{t('Editing')}</span>
                    )}
                </span>
                {reading && follow}
            </div>
            <div
                data-slot="read-mode-dock"
                className="pointer-events-none absolute right-4 bottom-6 z-10 flex h-14 max-w-full items-center gap-1"
            >
                {tools}
                <ReadModeToggle reading={reading} onChange={onChange} />
            </div>
        </>
    );
}
