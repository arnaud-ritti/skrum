import { usePage } from '@inertiajs/react';
import { Ellipsis } from 'lucide-react';
import type { BenchGroup } from '@/components/dev/bench';
import { SessionRow } from '@/components/skrum/session-row';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    sessionMeta,
    sessionOutcome,
    sessionStatus,
} from '@/lib/teams/sessions';
import type { TeamSession } from '@/lib/teams/sessions';

export const group: BenchGroup = 'skrum';

const Blank: Omit<TeamSession, 'kind' | 'id' | 'title'> = {
    url: '#',
    state: 'live',
    updatedAt: '2026-10-02T10:00:00+00:00',
    isDraft: false,
    phase: null,
    people: null,
    tasks: null,
    facilitator: null,
    answers: null,
    game: null,
    sprint: null,
    roti: null,
    actions: null,
    points: null,
    canDelete: false,
    canDuplicate: false,
};

const Samples: TeamSession[] = [
    {
        ...Blank,
        kind: 'retro',
        id: 'r1',
        title: 'Sprint 42 retro',
        phase: 'Writing',
        people: 9,
    },
    {
        ...Blank,
        kind: 'poker',
        id: 'p1',
        title: 'Sprint 43 refinement',
        tasks: 12,
    },
    {
        ...Blank,
        kind: 'whiteboard',
        id: 'w1',
        title: 'Q4 architecture',
        facilitator: 'Inès',
    },
    {
        ...Blank,
        kind: 'survey',
        id: 's1',
        title: 'Team health · October',
        answers: 7,
    },
    {
        ...Blank,
        kind: 'survey',
        id: 's2',
        title: 'Team pulse · November',
        state: 'upcoming',
        isDraft: true,
        answers: 0,
    },
    {
        ...Blank,
        kind: 'icebreaker',
        id: 'i1',
        title: 'Friday warm-up, with a title long enough to be cut at the end of the row',
        game: 'Hangman',
    },
];

const Listed: TeamSession[] = [
    {
        ...Blank,
        kind: 'retro',
        id: 'r2',
        title: 'Sprint 44 retro',
        phase: 'Voting',
        people: 7,
        actions: 1,
    },
    {
        ...Blank,
        kind: 'retro',
        id: 'r3',
        title: 'Sprint 41 retro',
        state: 'finished',
        phase: 'Completed',
        people: 8,
        roti: 4,
        actions: 3,
    },
    {
        ...Blank,
        kind: 'poker',
        id: 'p2',
        title: 'Sprint 42 refinement, with a title long enough to be cut at the end of the row',
        state: 'finished',
        tasks: 12,
        points: 34,
    },
    {
        ...Blank,
        kind: 'survey',
        id: 's3',
        title: 'Team health · September',
        state: 'finished',
        answers: 7,
        canDelete: true,
        canDuplicate: true,
    },
    {
        ...Blank,
        kind: 'whiteboard',
        id: 'w2',
        title: 'Roadmap',
        state: 'upcoming',
        facilitator: 'Inès',
        canDelete: true,
    },
];

export default function SessionRowSection() {
    const { t } = useTrans();
    const { locale } = usePage().props;

    return (
        <div className="flex max-w-2xl flex-col gap-6 p-4 md:p-6">
            <div className="flex flex-col gap-2">
                {Samples.map((sample) => (
                    <SessionRow
                        key={sample.id}
                        href={sample.url}
                        kind={sample.kind}
                        title={sample.title}
                        meta={sessionMeta(sample, t)}
                        badge={sample.isDraft ? t('Draft') : undefined}
                    />
                ))}
            </div>
            <div className="flex flex-col gap-2">
                {Listed.map((sample) => {
                    const status = sessionStatus(sample, t);
                    const isLive = sample.state === 'live';
                    const isPending = sample.state === 'upcoming';

                    return (
                        <SessionRow
                            key={sample.id}
                            href={sample.url}
                            kind={sample.kind}
                            title={sample.title}
                            meta={sessionMeta(sample, t)}
                            outcome={
                                sessionOutcome(sample, t, locale) ?? undefined
                            }
                            date={
                                isLive
                                    ? t('Now')
                                    : new Intl.DateTimeFormat(locale, {
                                          dateStyle: 'medium',
                                      }).format(new Date(sample.updatedAt))
                            }
                            badge={isPending ? status : undefined}
                            status={isPending ? undefined : status}
                            action={
                                isLive ? (
                                    <Button size="sm">{t('Join')}</Button>
                                ) : undefined
                            }
                            menu={
                                sample.canDelete ? (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t('More actions')}
                                    >
                                        <Ellipsis aria-hidden />
                                    </Button>
                                ) : undefined
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}
