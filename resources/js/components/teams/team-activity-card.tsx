import { Link, usePage } from '@inertiajs/react';
import { Fragment, useId } from 'react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
} from '@/components/ui/card';
import { useNow } from '@/hooks/use-now';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { activitySentence } from '@/lib/teams/activity';
import { cn } from '@/lib/utils';
import type { TeamActivityLine } from '@/types';

/** One line of the activity: who, the sentence, and the time its list gives it. */
export function ActivityLineRow({
    line,
    time,
    inline = false,
}: {
    line: TeamActivityLine;
    /** What the list says of `line.at`: how long ago, or the time of day. */
    time: string;
    /** The time at the end of the line rather than under it. */
    inline?: boolean;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 items-start gap-3">
            <PersonAvatar
                name={line.actor.name}
                src={line.actor.avatarUrl}
                size="sm"
                decorative
            />
            <div
                className={cn(
                    'flex min-w-0 flex-1 text-sm wrap-anywhere',
                    inline ? 'items-baseline gap-3' : 'flex-col',
                )}
            >
                <p className={cn('min-w-0', inline && 'flex-1')}>
                    <ActivitySentence
                        template={activitySentence(line.kind, t)}
                        line={line}
                    />
                </p>
                <time
                    dateTime={line.at}
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                    {time}
                </time>
            </div>
        </div>
    );
}

/** The last things that happened in the team, newest first (ScreenDashboard, "Activity"). */
export function TeamActivityCard({
    lines,
    allHref,
}: {
    lines: TeamActivityLine[];
    /** The page that holds every line; no link without it. */
    allHref?: string;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const headingId = useId();
    const now = useNow(lines);

    return (
        <Card asChild>
            <section
                id="activity"
                aria-labelledby={headingId}
                className="scroll-mt-20"
            >
                <CardHeader>
                    <h2
                        id={headingId}
                        className="text-base leading-snug font-title"
                    >
                        {t('Recent activity')}
                    </h2>
                    {allHref !== undefined && (
                        <CardAction>
                            <Button
                                variant="link"
                                size="sm"
                                className="px-0"
                                asChild
                            >
                                <Link href={allHref}>{t('All activity')}</Link>
                            </Button>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent>
                    {lines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('Nothing has happened in this team yet.')}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {lines.map((line) => (
                                <li
                                    key={line.id}
                                    data-test="activity-line"
                                    className="min-w-0"
                                >
                                    <ActivityLineRow
                                        line={line}
                                        time={formatRelativeTime(
                                            line.at,
                                            locale,
                                            now,
                                        )}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </section>
        </Card>
    );
}

function ActivitySentence({
    template,
    line,
}: {
    template: string;
    line: TeamActivityLine;
}) {
    const values: Record<string, ReactNode> = {
        actor: <strong className="font-semibold">{line.actor.name}</strong>,
        title:
            line.subject === null ? null : (
                <ActivitySubject subject={line.subject} />
            ),
    };

    return template
        .split(/(:actor|:title)/)
        .map((part, index) => (
            <Fragment key={index}>
                {part.startsWith(':') ? values[part.slice(1)] : part}
            </Fragment>
        ));
}

function ActivitySubject({
    subject,
}: {
    subject: NonNullable<TeamActivityLine['subject']>;
}) {
    if (subject.url === null) {
        return <strong className="font-semibold">{subject.title}</strong>;
    }

    return (
        <Link
            href={subject.url}
            className="rounded-sm font-semibold outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            {subject.title}
        </Link>
    );
}
