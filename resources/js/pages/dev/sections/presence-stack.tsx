import type { ReactNode } from 'react';
import { PresenceStack } from '@/components/skrum/presence-stack';
import type { Participant } from '@/components/skrum/presence-stack';
import { useTrans } from '@/hooks/use-trans';
import type { BenchGroup } from '@/components/dev/bench';

export const group: BenchGroup = 'skrum';

const Names = [
    'Camille Roux',
    'Arnaud Ritti',
    'Inès Benali',
    'Yuki Sato',
    'Sofia Lopes',
    'Noah Kern',
    'Mia Bauer',
    'Hugo Denis',
    'Lena Petit',
    'Omar Said',
    'Jade Fabre',
    'Eli Vidal',
];

function member(index: number, overrides: Partial<Participant> = {}) {
    const name = Names[index];

    return {
        id: `p${index}`,
        name,
        presence: index + 1,
        role: 'member',
        status: 'online',
        ...overrides,
    } satisfies Participant;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h3 className="text-overline text-muted-foreground uppercase">
                {title}
            </h3>
            <div className="flex flex-wrap items-center gap-6">{children}</div>
        </section>
    );
}

export default function PresenceStackSection() {
    const { t } = useTrans();
    const crowd = Names.map((_, index) =>
        member(index, {
            role: index === 0 ? 'facilitator' : 'member',
            isMe: index === 1,
        }),
    );
    const few = crowd.slice(0, 3);
    const mixed = [
        member(0, { role: 'facilitator' }),
        member(1, { isMe: true }),
        member(2, { typing: true }),
        member(4, { status: 'away', awayMinutes: 3 }),
        member(7, { status: 'offline' }),
        {
            ...member(5, { role: 'guest' }),
            name: t('Thoughtful Otter'),
        },
    ];
    const typing = [
        member(2, { typing: true }),
        member(3, { typing: true }),
        member(8),
    ];
    const guests = [
        member(5),
        { ...member(9, { role: 'guest' }), name: t('Thoughtful Otter') },
        { ...member(10, { role: 'guest' }), name: t('Curious Fox') },
        member(11),
    ];

    return (
        <div className="m-4 space-y-8 rounded-lg border bg-card p-6 shadow-card md:m-6">
            <Block title={t('Stack and +N (12 online)')}>
                <PresenceStack participants={crowd} onInvite={() => {}} />
            </Block>
            <Block title={t('Everyone fits (3 online)')}>
                <PresenceStack participants={few} />
            </Block>
            <Block title={t('Size small')}>
                <PresenceStack participants={crowd} size="sm" />
            </Block>
            <Block title={t('More than 12 participants')}>
                <PresenceStack
                    participants={[
                        ...crowd,
                        member(0, { id: 'extra-1', presence: 3 }),
                        member(1, { id: 'extra-2', presence: 6 }),
                        member(2, { id: 'extra-3', presence: 9 }),
                    ]}
                />
            </Block>
            <Block title={t('Online, away and disconnected (open the list)')}>
                <PresenceStack participants={mixed} onInvite={() => {}} />
            </Block>
            <Block title={t('Typing')}>
                <PresenceStack participants={typing} />
            </Block>
            <Block title={t('Anonymous guests')}>
                <PresenceStack participants={guests} />
            </Block>
            <Block title={t('Server avatars, one failing (initials fallback)')}>
                <PresenceStack
                    participants={[
                        member(0, {
                            role: 'facilitator',
                            avatarUrl: `/avatars/${'3'.repeat(32)}.svg`,
                        }),
                        member(1, {
                            isMe: true,
                            typing: true,
                            avatarUrl: `/avatars/${'5'.repeat(32)}.svg`,
                        }),
                        member(2, {
                            status: 'away',
                            avatarUrl: `/avatars/${'7'.repeat(32)}.svg`,
                        }),
                        member(3, { avatarUrl: '/dev/missing-avatar.png' }),
                        {
                            ...member(9, { role: 'guest' }),
                            name: t('Thoughtful Otter'),
                            avatarUrl: `/avatars/${'9'.repeat(32)}.svg`,
                        },
                    ]}
                />
            </Block>
            <Block title={t('Nobody connected')}>
                <PresenceStack participants={[]} />
            </Block>
            <Block title={t('One participant, 60-character name')}>
                <PresenceStack
                    participants={[
                        {
                            id: 'long-name',
                            name: 'Maximilienne-Alexandrine de la Tour du Pin-Chambly Saint-Exupéry',
                            role: 'member',
                            status: 'online',
                            typing: true,
                        },
                    ]}
                />
            </Block>
            <Block title={t('200 participants')}>
                <PresenceStack
                    participants={Array.from({ length: 200 }, (_, index) =>
                        member(index % Names.length, {
                            id: `crowd-${index}`,
                            presence: (index % 12) + 1,
                        }),
                    )}
                />
            </Block>
            <Block title={t('Without invite action')}>
                <PresenceStack participants={few} />
            </Block>
        </div>
    );
}
