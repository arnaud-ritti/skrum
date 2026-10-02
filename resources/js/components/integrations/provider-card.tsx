import { usePage } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type {
    IntegrationProviderCard,
    IntegrationProviderKey,
    TeamIntegration,
} from '@/types';

type ProviderIdentity = {
    key: IntegrationProviderKey;
    label: string;
    icon: LucideIcon;
};

type ProviderStatusTone = 'none' | 'active' | 'setup' | 'reconnect';

type ProviderStatus = { label: string; tone: ProviderStatusTone };

/** The confirmation of a disconnection, opened by the switch of the row. */
export type DisconnectControl = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type ProviderCardProps = {
    provider: ProviderIdentity;
    status: ProviderStatus;
    /** What the connection points to, after the status on its line. */
    summary?: string | null;
    /** Why the connection stopped working. */
    error?: string | null;
    /** What is connected: a `ProviderDetails` list. */
    details?: ReactNode;
    /** Buttons of the footer of the panel. */
    actions?: ReactNode;
    /** The confirmation shown when the switch of a connected provider is turned off. */
    disconnect?: (control: DisconnectControl) => ReactNode;
    /** Panels and notes of the provider, under the details. */
    children?: ReactNode;
};

const statusClasses: Record<ProviderStatusTone, string> = {
    none: 'text-muted-foreground',
    active: 'text-skrum-success-text',
    setup: 'text-skrum-warning-text',
    reconnect: 'text-skrum-destructive-text',
};

function toneOf(connection: TeamIntegration): ProviderStatusTone {
    if (connection.status === 'reconnect_required') {
        return 'reconnect';
    }

    if (connection.status === 'setup_required') {
        return 'setup';
    }

    return 'active';
}

function summaryParts(
    connection: TeamIntegration,
): (string | null | undefined)[] {
    const { settings } = connection;

    switch (connection.provider) {
        case 'slack':
            return [settings.teamName, settings.channelName];
        case 'telegram':
            return [settings.chatTitle];
        case 'jira':
            return [settings.siteName];
        case 'linear':
            return [settings.organizationName];
        case 'jira_dc':
            return [settings.serverTitle ?? settings.baseUrl];
        case 'github':
            return [settings.accountLogin];
        default:
            return [settings.host, settings.channelLabel];
    }
}

/** The workspace, site, chat or host of a connection, for the status line. */
export function providerSummary(connection: TeamIntegration): string | null {
    const parts = summaryParts(connection).filter(
        (part): part is string => typeof part === 'string' && part !== '',
    );

    return parts.length === 0 ? null : parts.join(' · ');
}

/** Identity, status and error of a provider row, from the server's card. */
export function providerCardProps(
    card: IntegrationProviderCard,
    icon: LucideIcon,
    t: (key: string) => string,
): Pick<ProviderCardProps, 'provider' | 'status' | 'summary' | 'error'> {
    const provider = { key: card.provider, label: card.label, icon };
    const connection = card.connection;

    if (connection === null) {
        return {
            provider,
            status: { label: t('Not connected'), tone: 'none' },
            summary: null,
            error: null,
        };
    }

    return {
        provider,
        status: { label: connection.statusLabel, tone: toneOf(connection) },
        summary: providerSummary(connection),
        error:
            connection.status === 'reconnect_required'
                ? connection.lastError
                : null,
    };
}

function isRendered(node: ReactNode): boolean {
    return node !== undefined && node !== null && typeof node !== 'boolean';
}

/**
 * One provider of the integrations card: a row with its status line, a
 * switch and the button that opens its details, panels and actions in a sheet.
 * A connection has no "off" state: the switch is on while the provider is
 * connected, turning it off asks to disconnect, turning it on opens the sheet
 * where the provider is connected.
 */
export function ProviderCard({
    provider,
    status,
    summary,
    error,
    details,
    actions,
    disconnect,
    children,
}: ProviderCardProps): ReactElement {
    const { t } = useTrans();
    const titleId = useId();
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const connected = status.tone !== 'none';
    const hasError = error !== undefined && error !== null && error !== '';
    const hasSummary =
        summary !== undefined && summary !== null && summary !== '';
    const statusLine = hasSummary
        ? `${status.label} · ${summary}`
        : status.label;

    const toggle = (next: boolean) => {
        if (next || disconnect === undefined) {
            setOpen(true);

            return;
        }

        setConfirming(true);
    };

    return (
        <section
            aria-labelledby={titleId}
            data-slot="provider-row"
            data-test={`integration-card-${provider.key}`}
            data-status={status.tone}
            className="flex min-w-0 flex-wrap items-center gap-3 px-5 py-3"
        >
            <span
                aria-hidden="true"
                data-slot="provider-card-logo"
                className="grid size-9 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground"
            >
                <provider.icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                <h3 id={titleId} className="truncate text-sm font-semibold">
                    {provider.label}
                </h3>
                <p
                    data-slot="provider-row-status"
                    data-tone={status.tone}
                    className={cn(
                        'text-xs break-words',
                        statusClasses[status.tone],
                    )}
                >
                    {statusLine}
                </p>
            </div>
            <Button
                type="button"
                variant={connected ? 'ghost' : 'outline'}
                size="sm"
                data-slot="provider-row-configure"
                aria-describedby={titleId}
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
            >
                {connected ? t('Configure') : t('Connect')}
            </Button>
            <Switch
                checked={connected}
                onCheckedChange={toggle}
                aria-labelledby={titleId}
            />
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    data-test={`integration-panel-${provider.key}`}
                    className="sm:max-w-2xl"
                >
                    <SheetHeader>
                        <SheetTitle>{provider.label}</SheetTitle>
                        <SheetDescription
                            className={cn(
                                'break-words',
                                statusClasses[status.tone],
                            )}
                        >
                            {statusLine}
                        </SheetDescription>
                    </SheetHeader>
                    <SheetBody className="flex min-w-0 flex-col gap-4 space-y-0">
                        {hasError && (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <AlertDescription className="break-words">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}
                        {isRendered(details) && details}
                        {children}
                    </SheetBody>
                    {isRendered(actions) && (
                        <SheetFooter className="min-w-0 flex-wrap items-center">
                            {actions}
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
            {connected &&
                disconnect?.({ open: confirming, onOpenChange: setConfirming })}
        </section>
    );
}

type ProviderDetailRow = {
    label: string;
    value: ReactNode;
};

/** What a connection points to, then who made it and when it was last checked. */
export function ProviderDetails({
    rows,
    connection,
}: {
    rows: ProviderDetailRow[];
    connection: TeamIntegration;
}): ReactElement {
    const { t } = useTrans();
    const { locale } = usePage().props;

    const formatDate = (value: string | null): string =>
        value === null
            ? t('Never')
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(new Date(value));

    const allRows: ProviderDetailRow[] = [
        ...rows,
        {
            label: t('Connected by'),
            value: connection.connectedBy ?? t('Former member'),
        },
        {
            label: t('Last checked'),
            value: formatDate(connection.lastCheckedAt),
        },
    ];

    return (
        <dl
            data-slot="provider-details"
            className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm"
        >
            {allRows.map((row) => (
                <Fragment key={row.label}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 font-medium break-words">
                        {row.value}
                    </dd>
                </Fragment>
            ))}
        </dl>
    );
}
