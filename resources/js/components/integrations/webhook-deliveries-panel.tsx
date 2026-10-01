import { usePage } from '@inertiajs/react';
import { useState } from 'react';
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

    const load = async (pageNumber: number) => {
        setBusy(true);

        try {
            setPage(
                await retroRequest<WebhookDeliveryPage>(
                    WebhookDeliveriesController.index(
                        { ...scope, integration: connection.id },
                        { query: { page: pageNumber } },
                    ),
                ),
            );
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);

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
                <Button variant="link" size="sm" onClick={toggle}>
                    {open ? t('Hide deliveries') : t('Show deliveries')}
                </Button>
            </div>
            {open && busy && page === null && <Spinner />}
            {open && page !== null && page.data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No deliveries yet.')}
                </p>
            )}
            {open && page !== null && page.data.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
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
                                            <code>
                                                {delivery.event ??
                                                    delivery.kind}
                                            </code>
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
