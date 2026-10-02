import { usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Send,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import WebhookDeliveriesController from '@/actions/App/Http/Controllers/Integrations/WebhookDeliveriesController';
import WebhookRedeliveriesController from '@/actions/App/Http/Controllers/Integrations/WebhookRedeliveriesController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogIcon,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    DeliveryStatus,
    IntegrationScope,
    TeamIntegration,
    WebhookDelivery,
    WebhookDeliveryDetails,
    WebhookDeliveryPage,
} from '@/types';
import { WebhookDeliveryDialog } from './webhook-delivery-dialog';

const PayloadRetentionDays = 30;
const DayMilliseconds = 86_400_000;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

const statusVariants: Record<DeliveryStatus, BadgeProps['variant']> = {
    sent: 'success',
    failed: 'destructive',
    queued: 'muted',
};

/** What one delivery shows, the same in the table row and in the phone card. */
type DeliveryLine = {
    delivery: WebhookDelivery;
    time: string;
    event: string;
    status: string;
    /** Why there is nothing to view, when the content is not kept. */
    contentNote: string | null;
    redeliverable: boolean;
};

type DeliveryRowsProps = {
    lines: DeliveryLine[];
    onView: (delivery: WebhookDelivery) => void;
    onRedeliver: (delivery: WebhookDelivery) => void;
};

function DeliveryActions({
    line,
    onView,
    onRedeliver,
}: {
    line: DeliveryLine;
    onView: (delivery: WebhookDelivery) => void;
    onRedeliver: (delivery: WebhookDelivery) => void;
}): ReactElement {
    const { t } = useTrans();

    if (line.contentNote !== null) {
        return (
            <span className="text-xs text-muted-foreground">
                {line.contentNote}
            </span>
        );
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-w-full"
                onClick={() => onView(line.delivery)}
            >
                <span className="truncate">{t('View')}</span>
            </Button>
            {line.redeliverable && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-w-full"
                    onClick={() => onRedeliver(line.delivery)}
                >
                    <span className="truncate">{t('Redeliver')}</span>
                </Button>
            )}
        </div>
    );
}

function DeliveryEvent({ line }: { line: DeliveryLine }): ReactElement {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <code className="min-w-0 font-mono text-xs font-medium break-all">
                {line.event}
            </code>
            {line.delivery.redeliveryOf !== null && (
                <Badge variant="outline">{t('Redelivery')}</Badge>
            )}
        </div>
    );
}

function DeliveryStatusBadge({ line }: { line: DeliveryLine }): ReactElement {
    return (
        <Badge
            variant={statusVariants[line.delivery.status]}
            data-status={line.delivery.status}
        >
            {line.status}
        </Badge>
    );
}

/**
 * The browser suite reads the cells of this table by their position: time,
 * event, status, attempts, response, error, actions.
 */
function DeliveriesTable({
    lines,
    onView,
    onRedeliver,
}: DeliveryRowsProps): ReactElement {
    const { t } = useTrans();

    return (
        <Table
            aria-label={t('Deliveries')}
            className="text-body-sm [&_td]:px-2 [&_td:first-child]:ps-3 [&_td:last-child]:pe-3 [&_th]:px-2 [&_th:first-child]:ps-3 [&_th:last-child]:pe-3"
        >
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead>{t('Time')}</TableHead>
                    <TableHead>{t('Event')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead className="text-right">
                        {t('Attempts')}
                    </TableHead>
                    <TableHead className="text-right">
                        {t('Response')}
                    </TableHead>
                    <TableHead>{t('Error')}</TableHead>
                    <TableHead>
                        <span className="sr-only">{t('Actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {lines.map((line) => (
                    <TableRow key={line.delivery.id}>
                        <TableCell className="min-w-24 text-muted-foreground tabular-nums">
                            {line.time}
                        </TableCell>
                        <TableCell className="[&_code]:break-normal [&_code]:whitespace-nowrap">
                            <DeliveryEvent line={line} />
                        </TableCell>
                        <TableCell>
                            <DeliveryStatusBadge line={line} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {line.delivery.attempts}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {line.delivery.responseStatus ?? '—'}
                        </TableCell>
                        <TableCell className="break-words">
                            {line.delivery.error ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap [&>div]:flex-nowrap">
                            <DeliveryActions
                                line={line}
                                onView={onView}
                                onRedeliver={onRedeliver}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

/** The deliveries of a narrow card: one block per delivery instead of a row. */
function DeliveryCards({
    lines,
    onView,
    onRedeliver,
}: DeliveryRowsProps): ReactElement {
    const { t } = useTrans();

    return (
        <ul className="flex min-w-0 flex-col divide-y">
            {lines.map((line) => (
                <li
                    key={line.delivery.id}
                    data-slot="delivery-card"
                    className="flex min-w-0 flex-col gap-2 p-3"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <DeliveryEvent line={line} />
                        </div>
                        <DeliveryStatusBadge line={line} />
                    </div>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm">
                        <dt className="text-muted-foreground">{t('Time')}</dt>
                        <dd className="min-w-0 tabular-nums">{line.time}</dd>
                        <dt className="text-muted-foreground">
                            {t('Attempts')}
                        </dt>
                        <dd className="min-w-0 tabular-nums">
                            {line.delivery.attempts}
                        </dd>
                        <dt className="text-muted-foreground">
                            {t('Response')}
                        </dt>
                        <dd className="min-w-0 tabular-nums">
                            {line.delivery.responseStatus ?? '—'}
                        </dd>
                        {line.delivery.error !== null && (
                            <>
                                <dt className="text-muted-foreground">
                                    {t('Error')}
                                </dt>
                                <dd className="min-w-0 break-words">
                                    {line.delivery.error}
                                </dd>
                            </>
                        )}
                    </dl>
                    <DeliveryActions
                        line={line}
                        onView={onView}
                        onRedeliver={onRedeliver}
                    />
                </li>
            ))}
        </ul>
    );
}

export function WebhookDeliveriesPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const titleId = useId();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState<WebhookDeliveryPage | null>(null);
    const [failed, setFailed] = useState(false);
    const latestRequest = useRef(0);
    const [viewing, setViewing] = useState<WebhookDelivery | null>(null);
    const [details, setDetails] = useState<WebhookDeliveryDetails | null>(null);
    const [detailsFailed, setDetailsFailed] = useState(false);
    const latestDetails = useRef(0);
    const [redelivering, setRedelivering] = useState<WebhookDelivery | null>(
        null,
    );
    const [redeliverError, setRedeliverError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);

    const load = async (pageNumber: number) => {
        const requestId = ++latestRequest.current;
        setBusy(true);
        setFailed(false);

        try {
            const loaded = await retroRequest<WebhookDeliveryPage>(
                WebhookDeliveriesController.index(
                    { ...scope, integration: connection.id },
                    { query: { page: pageNumber } },
                ),
            );

            if (requestId === latestRequest.current) {
                setPage(loaded);
            }
        } catch (error) {
            if (requestId === latestRequest.current) {
                setFailed(true);
                toast.error(
                    integrationErrorMessage(error, t('Something went wrong.')),
                );
            }
        } finally {
            if (requestId === latestRequest.current) {
                setBusy(false);
            }
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);

        if (!next) {
            latestRequest.current++;
            setBusy(false);
            setFailed(false);
        }

        if (next) {
            void load(1);
        }
    };

    const openDetails = async (delivery: WebhookDelivery) => {
        const requestId = ++latestDetails.current;
        setViewing(delivery);
        setDetails(null);
        setDetailsFailed(false);

        try {
            const loaded = await retroRequest<WebhookDeliveryDetails>(
                WebhookDeliveriesController.show({
                    ...scope,
                    integration: connection.id,
                    delivery: delivery.id,
                }),
            );

            if (requestId === latestDetails.current) {
                setDetails(loaded);
            }
        } catch {
            if (requestId === latestDetails.current) {
                setDetailsFailed(true);
            }
        }
    };

    const closeDetails = () => {
        latestDetails.current++;
        setViewing(null);
    };

    const askRedelivery = (delivery: WebhookDelivery) => {
        setRedeliverError(null);
        setRedelivering(delivery);
    };

    const redeliver = async () => {
        if (redelivering === null) {
            return;
        }

        setSending(true);
        setRedeliverError(null);

        try {
            await retroRequest<WebhookDelivery>(
                WebhookRedeliveriesController.store({
                    ...scope,
                    integration: connection.id,
                    delivery: redelivering.id,
                }),
            );
            toast(t('Delivery queued again.'));
            setRedelivering(null);
            void load(1);
        } catch (error) {
            setRedeliverError(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setSending(false);
        }
    };

    const contentNote = (delivery: WebhookDelivery): string => {
        const createdAt =
            delivery.createdAt === null
                ? null
                : new Date(delivery.createdAt).getTime();
        const expired =
            createdAt !== null &&
            Date.now() - createdAt > PayloadRetentionDays * DayMilliseconds;

        return expired ? t('Content no longer kept') : t('Content not kept');
    };

    const statusLabel = (status: DeliveryStatus): string => {
        switch (status) {
            case 'sent':
                return t('Sent');
            case 'failed':
                return t('Failed');
            default:
                return t('Queued');
        }
    };

    const kindLabel = (delivery: WebhookDelivery): string => {
        if (delivery.event !== null) {
            return delivery.event;
        }

        switch (delivery.kind) {
            case 'retro_link':
                return t('Board link');
            case 'poker_link':
                return t('Game link');
            case 'game_room_link':
                return t('Room invite');
            case 'retro_results':
                return t('Results');
            default:
                return delivery.kind;
        }
    };

    const formatTime = (value: string | null): string =>
        value === null
            ? '—'
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'short',
                  timeStyle: 'medium',
              }).format(new Date(value));

    const lines: DeliveryLine[] = (page?.data ?? []).map((delivery) => ({
        delivery,
        time: formatTime(delivery.lastAttemptAt ?? delivery.createdAt),
        event: kindLabel(delivery),
        status: statusLabel(delivery.status),
        contentNote: delivery.hasContent ? null : contentNote(delivery),
        redeliverable: delivery.redeliverable && connection.status === 'active',
    }));

    return (
        <section
            aria-labelledby={titleId}
            data-slot="webhook-deliveries"
            className="@container/deliveries flex min-w-0 flex-col gap-3 border-t pt-4"
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h4 id={titleId} className="min-w-0 text-sm font-semibold">
                    {t('Deliveries')}
                </h4>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={open}
                    className="group -me-2 max-w-full text-muted-foreground"
                    onClick={toggle}
                >
                    <span className="truncate">
                        {open ? t('Hide deliveries') : t('Show deliveries')}
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className="transition-transform duration-220 ease-standard group-aria-expanded:rotate-180 motion-reduce:transition-none"
                    />
                </Button>
            </div>
            {open && busy && page === null && (
                <div
                    role="status"
                    data-slot="deliveries-loading"
                    className="flex flex-col gap-2 rounded-lg border p-3"
                >
                    <span className="sr-only">{t('Loading…')}</span>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            )}
            {open && failed && (
                <div
                    data-slot="deliveries-error"
                    className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-skrum-destructive-soft px-3 py-2 text-sm text-skrum-destructive-text"
                >
                    <CircleAlert aria-hidden="true" className="size-4" />
                    <span className="min-w-0 flex-1 basis-40">
                        {t('Could not load the deliveries.')}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full text-foreground"
                        disabled={busy}
                        onClick={() => void load(page?.currentPage ?? 1)}
                    >
                        <span className="truncate">{t('Retry')}</span>
                    </Button>
                </div>
            )}
            {open && page !== null && page.data.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    {t('No deliveries yet.')}
                </p>
            )}
            {open && page !== null && page.data.length > 0 && (
                <>
                    <div
                        aria-busy={busy}
                        data-slot="deliveries-list"
                        className="min-w-0 overflow-hidden rounded-lg border aria-busy:opacity-60"
                    >
                        <div className="hidden @xl/deliveries:block">
                            <DeliveriesTable
                                lines={lines}
                                onView={(delivery) =>
                                    void openDetails(delivery)
                                }
                                onRedeliver={askRedelivery}
                            />
                        </div>
                        <div className="@xl/deliveries:hidden">
                            <DeliveryCards
                                lines={lines}
                                onView={(delivery) =>
                                    void openDetails(delivery)
                                }
                                onRedeliver={askRedelivery}
                            />
                        </div>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-w-full min-w-0"
                            disabled={busy || page.currentPage <= 1}
                            onClick={() => void load(page.currentPage - 1)}
                        >
                            <ChevronLeft aria-hidden="true" />
                            <span className="truncate">{t('Previous')}</span>
                        </Button>
                        <span className="min-w-0 text-center text-body-sm text-muted-foreground tabular-nums">
                            {t('Page :page of :pages', {
                                page: page.currentPage,
                                pages: page.lastPage,
                            })}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-w-full min-w-0"
                            disabled={busy || page.currentPage >= page.lastPage}
                            onClick={() => void load(page.currentPage + 1)}
                        >
                            <span className="truncate">{t('Next')}</span>
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </>
            )}
            {viewing !== null && (
                <WebhookDeliveryDialog
                    label={kindLabel(viewing)}
                    details={details}
                    failed={detailsFailed}
                    onClose={closeDetails}
                />
            )}
            {redelivering !== null && (
                <Dialog
                    open
                    onOpenChange={(next) => {
                        if (!next && !sending) {
                            setRedelivering(null);
                        }
                    }}
                >
                    <DialogContent
                        size="sm"
                        showCloseButton={false}
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            cancelRef.current?.focus();
                        }}
                        onInteractOutside={(event) => event.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogIcon>
                                <Send />
                            </DialogIcon>
                            <DialogTitle>{t('Redeliver')}</DialogTitle>
                            <DialogDescription>
                                {t('Send this delivery again to :host?', {
                                    host: connection.settings.host ?? '',
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        {redeliverError !== null && (
                            <p
                                role="alert"
                                data-slot="dialog-error"
                                className="flex items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                            >
                                <CircleAlert
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0"
                                />
                                <span className="min-w-0">
                                    {redeliverError}
                                </span>
                            </p>
                        )}
                        <DialogFooter>
                            <Button
                                ref={cancelRef}
                                type="button"
                                variant="outline"
                                disabled={sending}
                                onClick={() => setRedelivering(null)}
                            >
                                <span className="truncate">{t('Cancel')}</span>
                            </Button>
                            <LoadingButton
                                type="button"
                                loading={sending}
                                onClick={() => void redeliver()}
                            >
                                <span className="truncate">
                                    {t('Redeliver')}
                                </span>
                            </LoadingButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </section>
    );
}
