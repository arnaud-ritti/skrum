import { Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { claimEscape } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';

/**
 * Escape cancels an inline edit without closing the sheet or the dialog
 * that hosts it: the key is claimed before the overlay hears it.
 */
export function useInlineEscape(
    editor: RefObject<HTMLElement | null>,
    editing: boolean,
    onCancel: () => void,
): void {
    const cancel = useRef(onCancel);

    useEffect(() => {
        cancel.current = onCancel;
    });

    useEffect(() => {
        if (!editing) {
            return;
        }

        const claimOwnEscape = (event: KeyboardEvent): void => {
            if (
                event.key === 'Escape' &&
                event.target instanceof Node &&
                editor.current?.contains(event.target)
            ) {
                claimEscape(event);
                cancel.current();
            }
        };

        window.addEventListener('keydown', claimOwnEscape, true);

        return () =>
            window.removeEventListener('keydown', claimOwnEscape, true);
    }, [editor, editing]);
}

export function AnonymousNote() {
    const { t } = useTrans();

    return (
        <p
            data-slot="anonymous-note"
            className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground"
        >
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
                {t('Action items are not anonymous: your name is shown.')}
            </span>
        </p>
    );
}
