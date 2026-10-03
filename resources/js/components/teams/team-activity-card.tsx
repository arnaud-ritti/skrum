import { Link, usePage } from '@inertiajs/react';
import { useId, useState } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { activityVerb } from '@/lib/teams/activity';
import type { TeamActivityLine } from '@/types';

/** The last things that happened in the team, newest first (ScreenDashboard, "Activity"). */
export function TeamActivityCard({ lines }: { lines: TeamActivityLine[] }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const headingId = useId();
    const [now] = useState(() => Date.now());

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
                        {t('Activity')}
                    </h2>
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
                                    className="flex min-w-0 items-start gap-3"
                                >
                                    <PersonAvatar
                                        name={line.actor.name}
                                        src={line.actor.avatarUrl}
                                        size="sm"
                                        decorative
                                    />
                                    <div className="flex min-w-0 flex-1 flex-col text-sm wrap-anywhere">
                                        <p>
                                            <strong className="font-semibold">
                                                {line.actor.name}
                                            </strong>{' '}
                                            {activityVerb(line.kind, t)}
                                            {line.subject !== null && (
                                                <>
                                                    {' '}
                                                    <ActivitySubject
                                                        subject={line.subject}
                                                    />
                                                </>
                                            )}
                                        </p>
                                        <time
                                            dateTime={line.at}
                                            className="text-xs text-muted-foreground"
                                        >
                                            {formatRelativeTime(
                                                line.at,
                                                locale,
                                                now,
                                            )}
                                        </time>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </section>
        </Card>
    );
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
