import { usePage } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Children, Fragment, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
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

type ProviderCardProps = {
    provider: ProviderIdentity;
    /** The first badge of the card: the browser suite reads it as the status. */
    status: ProviderStatus;
    /** Why the connection stopped working. */
    error?: string | null;
    /** What is connected: a `ProviderDetails` list. */
    details?: ReactNode;
    /** Buttons of the footer band. */
    actions?: ReactNode;
    /** Panels and notes of the provider, under the details. */
    children?: ReactNode;
};

const statusVariants: Record<ProviderStatusTone, BadgeProps['variant']> = {
    none: 'outline',
    active: 'success',
    setup: 'warning',
    reconnect: 'destructive',
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

/** Identity, status and error of a provider card, from the server's card. */
export function providerCardProps(
    card: IntegrationProviderCard,
    icon: LucideIcon,
    t: (key: string) => string,
): Pick<ProviderCardProps, 'provider' | 'status' | 'error'> {
    const provider = { key: card.provider, label: card.label, icon };
    const connection = card.connection;

    if (connection === null) {
        return {
            provider,
            status: { label: t('Not connected'), tone: 'none' },
            error: null,
        };
    }

    return {
        provider,
        status: { label: connection.statusLabel, tone: toneOf(connection) },
        error:
            connection.status === 'reconnect_required'
                ? connection.lastError
                : null,
    };
}

function isRendered(node: ReactNode): boolean {
    return node !== undefined && node !== null && typeof node !== 'boolean';
}

export function ProviderCard({
    provider,
    status,
    error,
    details,
    actions,
    children,
}: ProviderCardProps): ReactElement {
    const titleId = useId();
    const hasError = error !== undefined && error !== null && error !== '';
    const hasDetails = isRendered(details);
    const hasChildren = Children.toArray(children).length > 0;
    const hasActions = isRendered(actions);

    return (
        <Card asChild data-test={`integration-card-${provider.key}`}>
            <section aria-labelledby={titleId} data-status={status.tone}>
                <div
                    data-slot="provider-card-header"
                    className="flex min-w-0 flex-wrap items-center gap-3 px-5 py-4"
                >
                    <span
                        aria-hidden="true"
                        data-slot="provider-card-logo"
                        className="grid size-9 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground"
                    >
                        <provider.icon className="size-4" />
                    </span>
                    <CardTitle
                        id={titleId}
                        role="heading"
                        aria-level={3}
                        className="min-w-0 flex-1 basis-32 truncate"
                    >
                        {provider.label}
                    </CardTitle>
                    <Badge
                        variant={statusVariants[status.tone]}
                        data-tone={status.tone}
                    >
                        {status.label}
                    </Badge>
                </div>
                {(hasError || hasDetails || hasChildren) && (
                    <div
                        data-slot="provider-card-body"
                        className="flex min-w-0 flex-col gap-4 border-t p-5"
                    >
                        {hasError && (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <AlertDescription className="break-words">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}
                        {hasDetails && details}
                        {children}
                    </div>
                )}
                {hasActions && (
                    <div
                        data-slot="provider-card-footer"
                        className="flex min-w-0 flex-wrap items-center gap-2 rounded-b-xl border-t bg-muted/50 px-5 py-3"
                    >
                        {actions}
                    </div>
                )}
            </section>
        </Card>
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
