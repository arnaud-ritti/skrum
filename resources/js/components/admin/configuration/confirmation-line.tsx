import { Link } from '@inertiajs/react';
import { LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

type ConfirmationState = { until: string | null; stale: boolean };

function isStale(until: string | null): boolean {
    return until === null || Date.parse(until) <= Date.now();
}

/**
 * Whether a configuration write would be refused for want of a fresh password
 * confirmation (rule S2): without one, once it passes (one timer, no polling),
 * or once the server refused one.
 */
export function useFreshConfirmation(confirmedUntil: string | null): {
    needsConfirmation: boolean;
    refuse: () => void;
} {
    const [state, setState] = useState<ConfirmationState>(() => ({
        until: confirmedUntil,
        stale: isStale(confirmedUntil),
    }));

    if (state.until !== confirmedUntil) {
        setState({ until: confirmedUntil, stale: isStale(confirmedUntil) });
    }

    useEffect(() => {
        if (confirmedUntil === null) {
            return;
        }

        const delay = Date.parse(confirmedUntil) - Date.now();

        if (delay <= 0) {
            return;
        }

        const timer = window.setTimeout(
            () => setState({ until: confirmedUntil, stale: true }),
            delay,
        );

        return () => window.clearTimeout(timer);
    }, [confirmedUntil]);

    return {
        needsConfirmation: state.stale,
        refuse: () => setState({ until: confirmedUntil, stale: true }),
    };
}

type ConfirmationLineProps = {
    visible: boolean;
    /** The password confirmation, back to this section. */
    confirmUrl: string;
};

export function ConfirmationLine({
    visible,
    confirmUrl,
}: ConfirmationLineProps) {
    const { t } = useTrans();

    // The live region stays mounted: one inserted with its text is often
    // not announced.
    return (
        <div role="status" className="contents">
            {visible && (
                <div
                    data-slot="confirmation-line"
                    className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg bg-skrum-info-soft px-4 py-3 text-sm text-skrum-info-text"
                >
                    <LockKeyhole
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1 basis-48">
                        {t('Confirm your password to change these settings.')}
                    </span>
                    <Button asChild size="sm" variant="outline">
                        <Link href={confirmUrl}>{t('Confirm')}</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
