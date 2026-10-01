import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    ConnectionState,
    EditingIndicator,
} from '@/components/skrum/connection-state';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function ConnectionStateSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Example label={t('Connection lost')}>
                    <ConnectionState status="offline" realtime="connecting" />
                </Example>
                <Example label={t('Connecting')}>
                    <ConnectionState status="connecting" />
                </Example>
                <Example label={t('Reconnecting, attempt 2 of 5')}>
                    <ConnectionState
                        status="reconnecting"
                        attempt={2}
                        maxAttempts={5}
                    />
                </Example>
                <Example label={t('Reconnected, changes synced')}>
                    <ConnectionState status="resynced" pendingChanges={3} />
                </Example>
                <Example label={t('Someone is editing')}>
                    <EditingIndicator
                        user={{
                            name: 'Inès Brun',
                            initials: 'IB',
                            presence: 9,
                        }}
                        target="card"
                    />
                </Example>
                <Example label={t('Connected, nothing shown')}>
                    <ConnectionState status="connected" />
                </Example>
            </div>
            <Example label={t('Banner, prolonged disconnection')}>
                <ConnectionState
                    status="offline"
                    variant="banner"
                    pendingChanges={2}
                    onRetry={() => undefined}
                    className="w-full"
                />
            </Example>
            <Example label={t('Banner, reconnecting')}>
                <ConnectionState
                    status="reconnecting"
                    variant="banner"
                    attempt={3}
                    maxAttempts={5}
                    className="w-full"
                />
            </Example>
            <Example label={t('Board veil during resynchronisation')}>
                <div className="relative h-32 w-full overflow-hidden rounded-xl border">
                    <div className="flex gap-3 p-4">
                        {[
                            t('Great job on the release'),
                            t('Try mob programming'),
                            t('Too many meetings on Monday'),
                        ].map((text) => (
                            <p
                                key={text}
                                className="w-40 rounded-lg border bg-card p-3 text-sm shadow-card"
                            >
                                {text}
                            </p>
                        ))}
                    </div>
                    <ConnectionState
                        status="reconnecting"
                        variant="overlay"
                        attempt={1}
                        maxAttempts={5}
                    />
                </div>
            </Example>
        </div>
    );
}
