import { Link } from '@inertiajs/react';
import { Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sessionKindTone } from '@/components/skrum/session-type-picker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { sessionMeta, sessionType } from '@/lib/teams/session-rows';
import { cn } from '@/lib/utils';
import type { RecentSessionRow } from '@/types';

type Props = {
    /** The sessions in progress, the most recently active first. */
    sessions: RecentSessionRow[];
    /** The Sessions page of the team, where the other live sessions are. */
    allSessionsHref: string;
};

/**
 * The session in progress and "Join", at the top of Home; nothing while no
 * session is live. The design system's info `Alert`, the icon in the colour
 * of the session's kind.
 */
export function LiveSessionBanner({ sessions, allSessionsHref }: Props) {
    const { t } = useTrans();
    const [announced, setAnnounced] = useState(false);
    const [session, ...others] = sessions;

    // A live region is announced when its text changes, not when it is
    // inserted with it: the text comes right after the banner mounts.
    useEffect(() => {
        const fill = window.setTimeout(() => setAnnounced(true), 0);

        return () => window.clearTimeout(fill);
    }, []);

    if (session === undefined) {
        return null;
    }

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
                    sessionKindTone(sessionType(session)),
                )}
            >
                <Radio className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 basis-48 flex-col">
                <p role="status" className="font-medium wrap-anywhere">
                    {announced &&
                        t('A session is in progress: :title', {
                            title: session.title,
                        })}
                </p>
                <p
                    data-slot="live-session-meta"
                    className="truncate text-xs text-foreground/85"
                >
                    {sessionMeta(session, t)}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                {others.length > 0 && (
                    <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="text-foreground"
                    >
                        <Link href={allSessionsHref}>
                            {t('+:count more', { count: others.length })}
                        </Link>
                    </Button>
                )}
                <Button asChild size="sm">
                    <Link href={session.url}>{t('Join')}</Link>
                </Button>
            </div>
        </Alert>
    );
}
