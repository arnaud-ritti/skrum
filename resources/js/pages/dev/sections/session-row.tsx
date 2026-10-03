import type { BenchGroup } from '@/components/dev/bench';
import { SessionRow } from '@/components/skrum/session-row';
import { useTrans } from '@/hooks/use-trans';
import { sessionMeta } from '@/lib/teams/sessions';
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

export default function SessionRowSection() {
    const { t } = useTrans();

    return (
        <div className="flex max-w-2xl flex-col gap-2 p-4 md:p-6">
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
    );
}
