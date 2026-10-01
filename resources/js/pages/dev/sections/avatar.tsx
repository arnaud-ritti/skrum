import type { ReactNode } from 'react';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence, AvatarSize } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import type { BenchGroup } from '@/components/dev/bench';

export const group: BenchGroup = 'ui';

const Sizes: AvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const Presences = Array.from(
    { length: 12 },
    (_, index) => (index + 1) as AvatarPresence,
);
const Names = [
    'Arnaud R.',
    'Tom M.',
    'Inès B.',
    'Chloé R.',
    'Sofia L.',
    'Noah K.',
    'Mia B.',
    'Hugo D.',
    'Lena P.',
    'Omar S.',
    'Jade F.',
    'Eli V.',
];

function Cell({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            {children}
            <span>{label}</span>
        </div>
    );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h3 className="text-overline text-muted-foreground uppercase">
                {title}
            </h3>
            <div className="flex flex-wrap items-end gap-6">{children}</div>
        </section>
    );
}

export default function AvatarSection() {
    const { t } = useTrans();
    const people = Names.slice(0, 9).map((name, index) => ({
        name,
        presence: Presences[index],
    }));

    return (
        <div className="m-4 space-y-8 rounded-lg border bg-card p-6 shadow-card md:m-6">
            <Block title={t('Sizes')}>
                {Sizes.map((size) => (
                    <Cell key={size} label={size}>
                        <PersonAvatar
                            name="Arnaud R."
                            presence={1}
                            size={size}
                        />
                    </Cell>
                ))}
            </Block>
            <Block title={t('States')}>
                <Cell label={t('Image loaded')}>
                    <PersonAvatar
                        name="Inès B."
                        presence={3}
                        size="lg"
                        src="/favicon.svg"
                    />
                </Cell>
                <Cell label={t('Loading')}>
                    <PersonAvatar
                        name="Inès B."
                        presence={3}
                        size="lg"
                        src="/dev/avatar-loading.png"
                    />
                </Cell>
                <Cell label={t('Image failed, initials')}>
                    <PersonAvatar name="Inès B." presence={3} size="lg" />
                </Cell>
                <Cell label={t('Online')}>
                    <PersonAvatar
                        name="Inès B."
                        presence={3}
                        size="lg"
                        status="online"
                    />
                </Cell>
                <Cell label={t('Away')}>
                    <PersonAvatar
                        name="Mia B."
                        presence={8}
                        size="lg"
                        status="away"
                    />
                </Cell>
                <Cell label={t('Writing')}>
                    <PersonAvatar
                        name="Sofia L."
                        presence={5}
                        size="lg"
                        typing
                    />
                </Cell>
                <Cell label={t('Guest')}>
                    <PersonAvatar name="Léa" size="lg" kind="guest" />
                </Cell>
                <Cell label={t('Anonymous')}>
                    <PersonAvatar name="Léa" size="lg" kind="anonymous" />
                </Cell>
            </Block>
            <Block title={t('Presence colours')}>
                {Presences.map((presence) => (
                    <Cell key={presence} label={`p${presence}`}>
                        <PersonAvatar
                            name={Names[presence - 1]}
                            presence={presence}
                            size="lg"
                        />
                    </Cell>
                ))}
            </Block>
            <Block title={t('Stack')}>
                <Cell label={t('Five shown, the rest as +N')}>
                    <AvatarStack
                        people={[
                            ...people.slice(0, 2),
                            { ...people[4], typing: true },
                            people[5],
                            { name: 'Léa', kind: 'guest' },
                            ...people.slice(6),
                        ]}
                    />
                </Cell>
                <Cell label={t('Everyone fits')}>
                    <AvatarStack people={people.slice(0, 3)} />
                </Cell>
                <Cell label={t('Small size')}>
                    <AvatarStack people={people} size="sm" max={4} />
                </Cell>
            </Block>
        </div>
    );
}
