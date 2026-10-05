import { usePage } from '@inertiajs/react';
import { Eye, Laptop, LogOut, MonitorOff, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { ReactElement } from 'react';
import { destroy as signOutDevice } from '@/actions/App/Http/Controllers/Settings/BrowserSessionsController';
import { destroy as signOutOthers } from '@/actions/App/Http/Controllers/Settings/OtherBrowserSessionsController';
import { usePasswordGate } from '@/components/settings/password-gate';
import { SettingsCard } from '@/components/settings/settings-card';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { deleteVisit } from '@/lib/visit';

export type BrowserSessionRow = {
    /** The hash of the session id: the id itself never leaves the server. */
    key: string;
    device: string;
    deviceKind: 'desktop' | 'phone' | 'unknown';
    ipAddress: string | null;
    isCurrent: boolean;
    lastActiveAt: string;
};

const ActiveNowMs = 2 * 60_000;

const DeviceIcons: Partial<
    Record<BrowserSessionRow['deviceKind'], LucideIcon>
> = {
    desktop: Laptop,
    phone: Smartphone,
};

function DeviceIcon({
    kind,
}: {
    kind: BrowserSessionRow['deviceKind'];
}): ReactElement {
    const Icon = DeviceIcons[kind] ?? MonitorOff;

    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-4" />
        </span>
    );
}

function IpAddress({ address }: { address: string | null }): ReactElement {
    const { t } = useTrans();

    if (address === null) {
        return (
            <span className="text-sm text-muted-foreground">
                {t('Unknown')}
            </span>
        );
    }

    return (
        <span className="font-mono text-sm">
            {address.split(/(?<=[:.])/).map((group, index) => (
                <Fragment key={index}>
                    {index > 0 && <wbr />}
                    {group}
                </Fragment>
            ))}
        </span>
    );
}

function useLastActive(): (session: BrowserSessionRow) => string {
    const { t } = useTrans();
    const locale = usePage().props.locale as string | undefined;
    const [now] = useState(() => Date.now());

    return (session) =>
        now - new Date(session.lastActiveAt).getTime() < ActiveNowMs
            ? t('Active now')
            : formatRelativeTime(session.lastActiveAt, locale ?? 'en', now);
}

function DeviceLabel({
    session,
    withAddress = false,
}: {
    session: BrowserSessionRow;
    withAddress?: boolean;
}): ReactElement {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 truncate text-sm font-semibold">
                    {session.device}
                </span>
                {session.isCurrent && (
                    <Badge
                        variant="success"
                        shape="pill"
                        dot="var(--skrum-success)"
                    >
                        {t('This device')}
                    </Badge>
                )}
            </span>
            {withAddress && <IpAddress address={session.ipAddress} />}
        </div>
    );
}

function SignOutButton({
    device,
    onClick,
}: {
    device: string;
    onClick: () => void;
}): ReactElement {
    const { t } = useTrans();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-full text-skrum-destructive-text hover:text-skrum-destructive-text"
            aria-label={t('Sign out :device', { device })}
            onClick={onClick}
        >
            <LogOut aria-hidden="true" />
            <span className="truncate">{t('Sign out')}</span>
        </Button>
    );
}

type SessionListProps = {
    sessions: BrowserSessionRow[];
    onSignOut: (session: BrowserSessionRow) => void;
};

function SessionTable({ sessions, onSignOut }: SessionListProps): ReactElement {
    const { t } = useTrans();
    const lastActive = useLastActive();

    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-5/12 px-5">{t('Device')}</TableHead>
                    <TableHead className="px-5">{t('IP address')}</TableHead>
                    <TableHead className="px-5">{t('Last active')}</TableHead>
                    <TableHead className="px-5">
                        <span className="sr-only">{t('Sign out')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sessions.map((session) => (
                    <TableRow key={session.key} data-session-key={session.key}>
                        <TableCell className="px-5 py-3 whitespace-normal">
                            <div className="flex min-w-0 items-center gap-3">
                                <DeviceIcon kind={session.deviceKind} />
                                <DeviceLabel session={session} />
                            </div>
                        </TableCell>
                        <TableCell className="px-5 py-3 whitespace-normal">
                            <IpAddress address={session.ipAddress} />
                        </TableCell>
                        <TableCell className="px-5 py-3 text-sm whitespace-nowrap">
                            {lastActive(session)}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-right">
                            {!session.isCurrent && (
                                <SignOutButton
                                    device={session.device}
                                    onClick={() => onSignOut(session)}
                                />
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function SessionCards({ sessions, onSignOut }: SessionListProps): ReactElement {
    const { t } = useTrans();
    const lastActive = useLastActive();

    return (
        <ul aria-label={t('Active sessions')} className="flex flex-col">
            {sessions.map((session) => (
                <li
                    key={session.key}
                    data-session-key={session.key}
                    className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 last:border-b-0"
                >
                    <DeviceIcon kind={session.deviceKind} />
                    <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                        <DeviceLabel session={session} withAddress />
                        <span className="text-sm text-muted-foreground">
                            {lastActive(session)}
                        </span>
                    </div>
                    {!session.isCurrent && (
                        <SignOutButton
                            device={session.device}
                            onClick={() => onSignOut(session)}
                        />
                    )}
                </li>
            ))}
        </ul>
    );
}

type ActiveSessionsCardProps = {
    /** Absent while the password is not confirmed: the server keeps the list back. */
    sessions: BrowserSessionRow[] | null;
};

/**
 * The devices signed in to the account: the browser and system, the full IP
 * address (the owner's choice, no location) and the last activity, each but
 * this one signed out on its own or all together.
 */
export function ActiveSessionsCard({
    sessions,
}: ActiveSessionsCardProps): ReactElement {
    const { t } = useTrans();
    const { guard } = usePasswordGate();
    const isMobile = useIsMobile();
    const [target, setTarget] = useState<BrowserSessionRow | null>(null);
    const [signingOutOne, setSigningOutOne] = useState(false);
    const [signingOutOthers, setSigningOutOthers] = useState(false);
    const [error, setError] = useState<string>();
    const hasOthers =
        sessions !== null && sessions.some((session) => !session.isCurrent);

    const signOut = async (url: string): Promise<void> => {
        setError(undefined);

        try {
            await deleteVisit(url);
        } catch (failure) {
            setError(t('Something went wrong. Please try again.'));

            throw failure;
        }
    };

    const changeOne = (open: boolean): void => {
        if (!open) {
            setError(undefined);
        }

        setSigningOutOne(open);
    };

    const changeOthers = (open: boolean): void => {
        if (!open) {
            setError(undefined);
        }

        setSigningOutOthers(open);
    };

    const askOne = (session: BrowserSessionRow): void =>
        guard(() => {
            setTarget(session);
            setSigningOutOne(true);
        });

    return (
        <div data-slot="active-sessions" className="min-w-0">
            <SettingsCard
                title={t('Active sessions')}
                description={t('Devices signed in to your account.')}
                flush
                action={
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full"
                        disabled={!hasOthers}
                        onClick={() => guard(() => changeOthers(true))}
                    >
                        <LogOut aria-hidden="true" />
                        <span className="truncate">
                            {t('Sign out other sessions')}
                        </span>
                    </Button>
                }
            >
                {sessions === null && (
                    <div
                        data-slot="active-sessions-concealed"
                        className="flex flex-col items-center gap-3 px-5 py-8 text-center"
                    >
                        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                            <Laptop aria-hidden="true" className="size-5" />
                        </span>
                        <p className="text-sm text-muted-foreground">
                            {t("Confirm it's you to see your devices.")}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-w-full"
                            onClick={() => guard(() => undefined)}
                        >
                            <Eye aria-hidden="true" />
                            <span className="truncate">
                                {t('Show my devices')}
                            </span>
                        </Button>
                    </div>
                )}
                {sessions !== null && isMobile && (
                    <SessionCards sessions={sessions} onSignOut={askOne} />
                )}
                {sessions !== null && !isMobile && (
                    <SessionTable sessions={sessions} onSignOut={askOne} />
                )}
            </SettingsCard>

            <ConfirmDialog
                open={signingOutOne}
                onOpenChange={changeOne}
                error={signingOutOne ? error : undefined}
                tone="destructive"
                title={t('Sign out this device?')}
                description={t(':device will need to sign in again.', {
                    device: target?.device ?? '',
                })}
                confirmLabel={t('Sign out')}
                onConfirm={() =>
                    target === null
                        ? Promise.resolve()
                        : signOut(signOutDevice.url(target.key))
                }
            />

            <ConfirmDialog
                open={signingOutOthers}
                onOpenChange={changeOthers}
                error={signingOutOthers ? error : undefined}
                tone="destructive"
                title={t('Sign out every other device?')}
                description={t(
                    'They will need to sign in again. "Remember me" ends on every device.',
                )}
                confirmLabel={t('Sign out')}
                onConfirm={() => signOut(signOutOthers.url())}
            />
        </div>
    );
}
