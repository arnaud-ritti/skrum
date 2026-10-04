import { Link } from '@inertiajs/react';
import { Radio, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sessionKindTone } from '@/components/skrum/session-type-picker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { LiveSessionFlash } from '@/lib/invitations/types';
import { cn } from '@/lib/utils';

/**
 * P25-10: right after landing on a team by an invitation or its link, the
 * session in progress and "Join". No mockup frame: the design system's
 * info `Alert`, the icon in the colour of the session's kind.
 */
export function LiveSessionBanner({
    session,
    onDismiss,
}: {
    session: LiveSessionFlash;
    onDismiss: () => void;
}) {
    const { t } = useTrans();
    const [announced, setAnnounced] = useState(false);

    // A live region is announced when its text changes, not when it is
    // inserted with it: the text comes right after the banner mounts.
    useEffect(() => {
        const fill = window.setTimeout(() => setAnnounced(true), 0);

        return () => window.clearTimeout(fill);
    }, []);

    return (
        <Alert
            variant="info"
            data-slot="live-session-banner"
            className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
            <span
                data-slot="live-session-kind"
                aria-hidden="true"
                className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md border',
                    sessionKindTone(session.kind),
                )}
            >
                <Radio className="size-4" />
            </span>
            <p
                role="status"
                className="min-w-0 flex-1 basis-48 font-medium wrap-anywhere"
            >
                {announced &&
                    t('A session is in progress: :title', {
                        title: session.title,
                    })}
            </p>
            <div className="flex shrink-0 items-center gap-1">
                <Button asChild size="sm">
                    <Link href={session.url}>{t('Join')}</Link>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Dismiss')}
                    onClick={onDismiss}
                    className="text-foreground"
                >
                    <X aria-hidden="true" />
                </Button>
            </div>
        </Alert>
    );
}
