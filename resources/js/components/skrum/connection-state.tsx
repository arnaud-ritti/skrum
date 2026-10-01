import { CheckIcon, RefreshCwIcon, WifiOffIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type ConnectionStatus =
    | 'connected'
    | 'connecting'
    | 'reconnecting'
    | 'offline'
    | 'resynced';

export type ConnectionStateProps = {
    status: ConnectionStatus;
    attempt?: number;
    maxAttempts?: number;
    pendingChanges?: number;
    variant?: 'pill' | 'banner' | 'overlay';
    onRetry?: () => void;
    realtime?: string;
    className?: string;
};

export type EditingIndicatorProps = {
    user: { name: string; initials: string; presence: number };
    target: 'card' | 'group' | 'column';
    className?: string;
};

const presenceTextClasses = [
    'text-skrum-presence-1',
    'text-skrum-presence-2',
    'text-skrum-presence-3',
    'text-skrum-presence-4',
    'text-skrum-presence-5',
    'text-skrum-presence-6',
    'text-skrum-presence-7',
    'text-skrum-presence-8',
    'text-skrum-presence-9',
    'text-skrum-presence-10',
    'text-skrum-presence-11',
    'text-skrum-presence-12',
];

type PresenceSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

function presenceSlot(presence: number): PresenceSlot {
    const slot = Math.round(presence);

    if (slot < 1 || slot > 12) {
        return 1;
    }

    return slot as PresenceSlot;
}

export function Trema({
    size = 'sm',
    className,
}: {
    size?: 'sm' | 'lg';
    className?: string;
}) {
    const dot = cn(
        'animate-trema rounded-full bg-current motion-reduce:animate-none',
        size === 'lg' ? 'size-1.5' : 'size-1',
    );

    return (
        <span
            aria-hidden="true"
            data-slot="trema"
            className={cn('inline-flex shrink-0 items-center gap-1', className)}
        >
            <span className={dot} />
            <span className={dot} style={{ animationDelay: '180ms' }} />
        </span>
    );
}

const pillBase =
    'inline-flex h-7.5 max-w-full items-center gap-2 rounded-full px-3 text-xs font-semibold';

const toneClasses = {
    warning: 'bg-skrum-warning-soft text-skrum-warning-text',
    lost: 'bg-skrum-destructive-soft text-skrum-destructive-text',
    ok: 'bg-skrum-success-soft text-skrum-success-text',
};

function useStatusCopy(
    status: ConnectionStatus,
    attempt?: number,
    maxAttempts?: number,
    pendingChanges?: number,
) {
    const { t } = useTrans();

    if (status === 'offline') {
        return { tone: 'lost' as const, label: t('Offline') };
    }

    if (status === 'resynced') {
        const synced =
            pendingChanges && pendingChanges > 0
                ? t(':count changes synced', { count: pendingChanges })
                : null;

        return { tone: 'ok' as const, label: t('Reconnected'), detail: synced };
    }

    if (status === 'connecting') {
        return { tone: 'warning' as const, label: t('Connecting…') };
    }

    const label =
        attempt && maxAttempts
            ? t('Reconnecting… (:attempt/:max)', {
                  attempt,
                  max: maxAttempts,
              })
            : t('Reconnecting…');

    return { tone: 'warning' as const, label };
}

function Marker({
    status,
    size = 'sm',
}: {
    status: ConnectionStatus;
    size?: 'sm' | 'lg';
}) {
    if (status === 'offline') {
        return <WifiOffIcon aria-hidden="true" className="size-4 shrink-0" />;
    }

    if (status === 'resynced') {
        return <CheckIcon aria-hidden="true" className="size-4 shrink-0" />;
    }

    return <Trema size={size} />;
}

export function ConnectionState({
    status,
    attempt,
    maxAttempts,
    pendingChanges,
    variant = 'pill',
    onRetry,
    realtime,
    className,
}: ConnectionStateProps) {
    const { t } = useTrans();
    const copy = useStatusCopy(status, attempt, maxAttempts, pendingChanges);

    if (status === 'connected') {
        return realtime ? (
            <span hidden data-realtime={realtime} className={className} />
        ) : null;
    }

    const detail = 'detail' in copy ? copy.detail : null;

    if (variant === 'banner') {
        const isOffline = status === 'offline';
        const keptLocally = t(
            'Your cards are kept locally and will be sent when the network returns.',
        );

        return (
            <div
                role={isOffline ? 'alert' : 'status'}
                data-slot="connection-state"
                data-variant="banner"
                data-status={status}
                data-realtime={realtime}
                className={cn(
                    'flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg px-4 py-2.5 text-sm/snug',
                    toneClasses[copy.tone],
                    className,
                )}
            >
                <span className="mt-0.5 flex shrink-0">
                    <Marker status={status} />
                </span>
                <span className="min-w-0 flex-1 basis-48">
                    <span className="font-semibold">
                        {isOffline
                            ? t('Connection to the server lost.')
                            : copy.label}
                    </span>
                    {isOffline || status === 'reconnecting' ? (
                        <> {keptLocally}</>
                    ) : null}
                    {detail ? ` ${detail}` : null}
                    {pendingChanges && status !== 'resynced' ? (
                        <>
                            {' '}
                            {t(':count changes waiting', {
                                count: pendingChanges,
                            })}
                        </>
                    ) : null}
                </span>
                {isOffline && onRetry ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                        className="ml-auto shrink-0 bg-background"
                    >
                        <RefreshCwIcon aria-hidden="true" />
                        {t('Retry')}
                    </Button>
                ) : null}
            </div>
        );
    }

    const pill = (
        <span
            role="status"
            aria-live="polite"
            data-slot="connection-state"
            data-variant={variant}
            data-status={status}
            data-realtime={realtime}
            className={cn(
                pillBase,
                toneClasses[copy.tone],
                variant === 'overlay' && 'pointer-events-auto',
                className,
            )}
        >
            <Marker
                status={status}
                size={variant === 'overlay' ? 'lg' : 'sm'}
            />
            <span className="truncate">{copy.label}</span>
            {detail ? (
                <span className="truncate font-medium opacity-80">
                    {detail}
                </span>
            ) : null}
            {status === 'offline' && onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    className="truncate rounded-xs underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t('Retry')}
                </button>
            ) : null}
        </span>
    );

    if (variant === 'overlay') {
        return (
            <div
                data-slot="connection-overlay"
                className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[color-mix(in_oklch,var(--background)_55%,transparent)] p-4"
            >
                {pill}
            </div>
        );
    }

    return pill;
}

export function EditingIndicator({
    user,
    target,
    className,
}: EditingIndicatorProps) {
    const { t } = useTrans();
    const labels: Record<EditingIndicatorProps['target'], string> = {
        card: t(':name is editing the card', { name: user.name }),
        group: t(':name is editing the group', { name: user.name }),
        column: t(':name is editing the column', { name: user.name }),
    };
    const slot = presenceSlot(user.presence);
    const label: ReactNode = labels[target];

    return (
        <span
            role="status"
            aria-live="polite"
            data-slot="editing-indicator"
            data-target={target}
            className={cn(
                'inline-flex h-7.5 max-w-full items-center gap-2 rounded-full border bg-card pr-3 pl-1 text-xs font-semibold text-foreground shadow-card',
                className,
            )}
        >
            <PersonAvatar
                decorative
                name={user.name}
                presence={slot}
                size="xs"
            />
            <span className="truncate">{label}</span>
            <Trema className={presenceTextClasses[slot - 1]} />
        </span>
    );
}
