import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { GuestJoin } from '@/components/skrum/guest-join';
import type { GuestJoinProps } from '@/components/skrum/guest-join';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function GuestJoinSection() {
    const { t } = useTrans();
    const session: GuestJoinProps['session'] = {
        code: 'K7Q2',
        kind: 'retro',
        title: t('Sprint 42 retro · Atlas team'),
        status: 'live',
        participants: 9,
        facilitator: 'Camille',
    };
    const common = { session, loginUrl: '/dev/design-system/auth' };
    const noop = () => undefined;

    return (
        <div className="grid max-w-240 items-start gap-6 p-6 md:grid-cols-2">
            <State label={t('Filled, colour chosen')}>
                <GuestJoin
                    {...common}
                    initialName="Nadia"
                    initialPresence={5}
                    takenColors={[]}
                    onSubmit={noop}
                />
            </State>
            <div className="flex flex-col gap-6">
                <State label={t('Name already taken (button disabled)')}>
                    <GuestJoin
                        {...common}
                        initialName="Théo"
                        takenColors={[]}
                        error={{
                            field: 'name',
                            message: t(
                                '“Théo” is already in the session. Try “Théo B.”.',
                            ),
                        }}
                        onSubmit={noop}
                    />
                </State>
                <State label={t('Empty name, random nickname proposed')}>
                    <GuestJoin
                        {...common}
                        defaultName={t('Thoughtful otter')}
                        onRandomName={noop}
                        onSubmit={noop}
                    />
                </State>
                <State label={t('Colours already taken (disabled)')}>
                    <GuestJoin
                        {...common}
                        initialName="Nadia"
                        takenColors={[1, 2, 3, 4, 6, 9]}
                        initialPresence={5}
                        onSubmit={noop}
                    />
                </State>
                <State label={t('Loading')}>
                    <GuestJoin
                        {...common}
                        initialName="Nadia"
                        processing
                        onSubmit={noop}
                    />
                </State>
                <State label={t('Scheduled session, no colour picker')}>
                    <GuestJoin
                        {...common}
                        session={{
                            ...session,
                            kind: 'poker',
                            status: 'scheduled',
                            participants: 1,
                        }}
                        initialName="Nadia"
                        onSubmit={noop}
                    />
                </State>
            </div>
        </div>
    );
}
