import { usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import WebhookDeliveriesController from '@/actions/App/Http/Controllers/Integrations/WebhookDeliveriesController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    DeliveryStatus,
    IntegrationScope,
    TeamIntegration,
    WebhookDelivery,
    WebhookDeliveryPage,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

export function WebhookDeliveriesPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState<WebhookDeliveryPage | null>(null);
    const [failed, setFailed] = useState(false);
    const latestRequest = useRef(0);

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

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t('Deliveries')}</h3>
                <Button
                    variant="link"
                    size="sm"
                    aria-expanded={open}
                    onClick={toggle}
                >
                    {open ? t('Hide deliveries') : t('Show deliveries')}
                </Button>
            </div>
            {open && busy && <Spinner />}
            {open && failed && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                    <span>{t('Could not load the deliveries.')}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void load(page?.currentPage ?? 1)}
                    >
                        {t('Retry')}
                    </Button>
                </div>
            )}
            {open && page !== null && page.data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No deliveries yet.')}
                </p>
            )}
            {open && page !== null && page.data.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table
                            className="w-full text-left text-xs"
                            aria-label={t('Deliveries')}
                        >
                            <thead className="text-muted-foreground">
                                <tr>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Time')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Event')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Status')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Attempts')}
                                    </th>
                                    <th className="py-1 pr-3 font-medium">
                                        {t('Response')}
                                    </th>
                                    <th className="py-1 font-medium">
                                        {t('Error')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.data.map((delivery) => (
                                    <tr key={delivery.id} className="border-t">
                                        <td className="py-1 pr-3 whitespace-nowrap">
                                            {formatTime(
                                                delivery.lastAttemptAt ??
                                                    delivery.createdAt,
                                            )}
                                        </td>
                                        <td className="py-1 pr-3">
                                            <code>{kindLabel(delivery)}</code>
                                        </td>
                                        <td className="py-1 pr-3">
                                            {statusLabel(delivery.status)}
                                        </td>
                                        <td className="py-1 pr-3">
                                            {delivery.attempts}
                                        </td>
                                        <td className="py-1 pr-3">
                                            {delivery.responseStatus ?? '—'}
                                        </td>
                                        <td className="py-1 break-words">
                                            {delivery.error ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || page.currentPage <= 1}
                            onClick={() => void load(page.currentPage - 1)}
                        >
                            {t('Previous')}
                        </Button>
                        <span className="text-muted-foreground">
                            {t('Page :page of :pages', {
                                page: page.currentPage,
                                pages: page.lastPage,
                            })}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || page.currentPage >= page.lastPage}
                            onClick={() => void load(page.currentPage + 1)}
                        >
                            {t('Next')}
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}
