import type { HTMLAttributes, ReactNode, Ref } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { ConnectionState } from '@/components/skrum/connection-state';
import { ObserverNotice } from '@/components/session/observer-notice';
import { useTrans } from '@/hooks/use-trans';
import SessionLayout from '@/layouts/skrum/session-layout';
import type {
    SessionChrome,
    SessionSelf,
} from '@/layouts/skrum/session-layout';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import { cn } from '@/lib/utils';

export type SessionConnection = { reconnecting: boolean; expired: boolean };

/** The live session types; picks the sentence of the reconnecting banner. */
export type SessionKind = 'retro' | 'poker' | 'game' | 'whiteboard' | 'survey';

type SessionShellProps = {
    /** Session type: the reconnecting banner says what is true for it. */
    kind: SessionKind;
    /** Left of the header: usually <SessionTitle>. */
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    /** `logo`: no application rail, the logo opens the header (whiteboard). Default `rail`. */
    chrome?: SessionChrome;
    /** Where the logo of `chrome="logo"` leads; null for a guest. */
    homeHref?: NavHref | null;
    /** The viewer, shown at the end of the header; needed for a guest, who has no account. */
    self?: SessionSelf | null;
    /** The cards of a poker game, for the shortcuts dialog. */
    deck?: readonly string[];
    /** Value of the page's single `data-realtime` attribute. */
    realtime: RealtimeState;
    connection: SessionConnection;
    /** The realtime root; the whiteboard sets `data-scene` on it. */
    rootRef?: Ref<HTMLDivElement>;
    /** The viewer observes the team: one line under the header. */
    observing?: boolean;
    rootProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
        [key: `data-${string}`]: string | undefined;
    };
    children: ReactNode;
};

function useReconnectingHint(kind: SessionKind): string {
    const { t } = useTrans();

    switch (kind) {
        case 'game':
            return t('Live updates are paused. The round may have moved on.');
        case 'whiteboard':
            return t(
                "Live updates are paused. Other people's changes appear when the connection returns.",
            );
        case 'survey':
            return t(
                'Your answers are saved as you give them; the counter is paused.',
            );
        default:
            return t(
                'Live updates are paused. What you see may be out of date.',
            );
    }
}

export function SessionShell({
    kind,
    title,
    phases,
    timer,
    presence,
    actions,
    chrome,
    homeHref,
    self,
    deck,
    realtime,
    connection,
    rootRef,
    rootProps,
    observing = false,
    children,
}: SessionShellProps) {
    const { t } = useTrans();
    const { className, ...root } = rootProps ?? {};
    const isReconnecting = connection.reconnecting && !connection.expired;
    const isSynced =
        realtime === 'connected' &&
        !connection.reconnecting &&
        !connection.expired;
    const reconnectingHint = useReconnectingHint(kind);

    return (
        <SessionLayout
            title={title}
            phases={phases}
            timer={timer}
            presence={presence}
            actions={actions}
            chrome={chrome}
            homeHref={homeHref}
            self={self}
            deck={deck}
            status={
                <>
                    {isReconnecting && (
                        <span
                            aria-hidden="true"
                            data-slot="session-connection-pill"
                            className="hidden shrink-0 md:flex"
                        >
                            <ConnectionState
                                status="reconnecting"
                                variant="pill"
                            />
                        </span>
                    )}
                    {isSynced && (
                        <span
                            data-slot="session-synced"
                            title={t('Synced')}
                            className="hidden shrink-0 md:flex"
                        >
                            <ConnectionState
                                status="synced"
                                variant="pill"
                                className="max-xl:px-2.5"
                                labelClassName="max-xl:sr-only"
                            />
                        </span>
                    )}
                </>
            }
        >
            <div
                {...root}
                ref={rootRef}
                data-slot="session-root"
                data-realtime={realtime}
                className={cn('flex h-full min-h-0 flex-col', className)}
            >
                {isReconnecting && (
                    <ConnectionState
                        status="reconnecting"
                        variant="banner"
                        hint={reconnectingHint}
                        className="m-2"
                    />
                )}
                {connection.expired && (
                    <ConnectionState
                        status="expired"
                        variant="banner"
                        onReload={() => window.location.reload()}
                        className="m-2"
                    />
                )}
                {observing && <ObserverNotice />}
                <div
                    inert={connection.expired}
                    className="relative min-h-0 flex-1"
                >
                    {children}
                </div>
            </div>
        </SessionLayout>
    );
}
