import { usePage } from '@inertiajs/react';
import { Eye, Info, KeyRound, Link, Unlink } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import {
    create as linkAccount,
    destroy as unlinkAccount,
} from '@/actions/App/Http/Controllers/Settings/LinkedAccountsController';
import { usePasswordGate } from '@/components/settings/password-gate';
import { SettingsCard } from '@/components/settings/settings-card';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { ProviderMark } from '@/components/skrum/provider-mark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { formatShortDate } from '@/lib/action-items/format';
import { deleteVisit, VisitError } from '@/lib/visit';

export type LinkedAccountRow = {
    provider: string;
    label: string;
    /** False for a provider turned off: its identity counts for nothing and may go. */
    isEnabled: boolean;
    account: {
        id: string;
        linkedAt: string | null;
        /** Single sign-on is required: the identity stays. */
        isManaged: boolean;
        canUnlink: boolean;
    } | null;
};

export type LinkedAccounts = {
    rows: LinkedAccountRow[];
    /** An identity is kept only because it is the last way in. */
    lastWayIn: boolean;
};

function ProviderTile({ row }: { row: LinkedAccountRow }): ReactElement {
    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <ProviderMark provider={row.provider} label={row.label} />
        </span>
    );
}

function UnlinkButton({
    provider,
    reason,
    onClick,
}: {
    provider: string;
    /** Why the identity cannot go: the button is disabled and says so. */
    reason?: string;
    onClick: () => void;
}): ReactElement {
    const { t } = useTrans();
    const reasonId = useId();
    const button = (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-full text-skrum-destructive-text hover:text-skrum-destructive-text"
            disabled={reason !== undefined}
            aria-describedby={reason === undefined ? undefined : reasonId}
            aria-label={t('Unlink :provider', { provider })}
            onClick={onClick}
        >
            <Unlink aria-hidden="true" />
            <span className="truncate">{t('Unlink')}</span>
        </Button>
    );

    if (reason === undefined) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    tabIndex={0}
                    className="inline-flex max-w-full rounded-md"
                >
                    {button}
                    <span id={reasonId} className="sr-only">
                        {reason}
                    </span>
                </span>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
    );
}

function AccountRow({
    row,
    onLink,
    onUnlink,
}: {
    row: LinkedAccountRow;
    onLink: (row: LinkedAccountRow) => void;
    onUnlink: (row: LinkedAccountRow) => void;
}): ReactElement {
    const { t } = useTrans();
    const locale = (usePage().props.locale as string | undefined) ?? 'en';
    const { account } = row;
    const lastWayInReason = t(
        "You can't unlink your last sign-in method: set a password or link another account first.",
    );

    let status = t('Not linked');

    if (account !== null) {
        status =
            account.linkedAt === null
                ? t('Linked')
                : t('Linked :date', {
                      date: formatShortDate(account.linkedAt, locale),
                  });
    }

    if (!row.isEnabled) {
        status = t('Not available on this instance');
    }

    return (
        <li
            data-linked-provider={row.provider}
            className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 last:border-b-0"
        >
            <ProviderTile row={row} />
            <div className="flex min-w-0 flex-1 basis-40 flex-col">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-sm font-semibold">
                        {row.label}
                    </span>
                    {account?.isManaged === true && (
                        <Badge variant="outline" shape="pill">
                            {t('Managed by your admin')}
                        </Badge>
                    )}
                </span>
                <span className="text-sm text-muted-foreground">{status}</span>
            </div>
            {account === null && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-w-full"
                    onClick={() => onLink(row)}
                >
                    <Link aria-hidden="true" />
                    <span className="truncate">
                        {t('Link :provider', { provider: row.label })}
                    </span>
                </Button>
            )}
            {account !== null && !account.isManaged && (
                <UnlinkButton
                    provider={row.label}
                    reason={account.canUnlink ? undefined : lastWayInReason}
                    onClick={() => onUnlink(row)}
                />
            )}
        </li>
    );
}

type LinkedAccountsCardProps = {
    /** Absent while the password is not confirmed: the server keeps the list back. */
    accounts: LinkedAccounts | null;
};

/**
 * The single sign-on identities of the account: one row per provider of the
 * instance, and any identity of a provider turned off. An identity is never
 * unlinked when it is the last way in; none is offered as a confirmation
 * (rule S-1: an account without a known password is asked none).
 */
export function LinkedAccountsCard({
    accounts,
}: LinkedAccountsCardProps): ReactElement {
    const { t } = useTrans();
    const { guard } = usePasswordGate();
    const [target, setTarget] = useState<LinkedAccountRow | null>(null);
    const [unlinking, setUnlinking] = useState(false);
    const [error, setError] = useState<string>();

    const link = (row: LinkedAccountRow): void =>
        guard(() => window.location.assign(linkAccount.url(row.provider)));

    const askUnlink = (row: LinkedAccountRow): void =>
        guard(() => {
            setTarget(row);
            setUnlinking(true);
        });

    const changeUnlinking = (open: boolean): void => {
        if (!open) {
            setError(undefined);
        }

        setUnlinking(open);
    };

    const unlink = async (): Promise<void> => {
        if (target?.account == null) {
            return;
        }

        setError(undefined);

        try {
            await deleteVisit(unlinkAccount.url(target.account.id));
        } catch (failure) {
            const refusal =
                failure instanceof VisitError
                    ? Object.values(failure.errors)[0]
                    : undefined;

            if (refusal !== undefined) {
                toast.error(refusal);

                return;
            }

            setError(t('Something went wrong. Please try again.'));

            throw failure;
        }
    };

    return (
        <div data-slot="linked-accounts" className="min-w-0">
            <SettingsCard
                title={t('Linked accounts')}
                description={t(
                    'Sign in with your company SSO or an existing account. Keep at least one way in.',
                )}
                flush
                footer={
                    accounts?.lastWayIn === true ? (
                        <p
                            data-slot="linked-accounts-note"
                            className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground"
                        >
                            <Info
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                            />
                            <span className="min-w-0">
                                {t(
                                    "You can't unlink your last sign-in method: set a password or link another account first.",
                                )}
                            </span>
                        </p>
                    ) : undefined
                }
            >
                {accounts === null && (
                    <div
                        data-slot="linked-accounts-concealed"
                        className="flex flex-col items-center gap-3 px-5 py-8 text-center"
                    >
                        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                            <KeyRound aria-hidden="true" className="size-5" />
                        </span>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Confirm your password to see your linked accounts.',
                            )}
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
                                {t('Show my linked accounts')}
                            </span>
                        </Button>
                    </div>
                )}
                {accounts !== null && (
                    <ul
                        aria-label={t('Linked accounts')}
                        className="flex flex-col"
                    >
                        {accounts.rows.map((row) => (
                            <AccountRow
                                key={row.provider}
                                row={row}
                                onLink={link}
                                onUnlink={askUnlink}
                            />
                        ))}
                    </ul>
                )}
            </SettingsCard>

            <ConfirmDialog
                open={unlinking}
                onOpenChange={changeUnlinking}
                error={unlinking ? error : undefined}
                tone="destructive"
                title={t('Unlink :provider?', {
                    provider: target?.label ?? '',
                })}
                description={t(
                    'You will no longer sign in with :provider. You can link it again later.',
                    { provider: target?.label ?? '' },
                )}
                confirmLabel={t('Unlink')}
                onConfirm={unlink}
            />
        </div>
    );
}
