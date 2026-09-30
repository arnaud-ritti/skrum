import { usePage } from '@inertiajs/react';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { deliveryChannelLabel } from '@/lib/integrations';
import type { IntegrationDelivery } from '@/types';

type Props = {
    deliveries: IntegrationDelivery[];
};

export function DeliveryLines({ deliveries }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const isMounted = useIsMounted();

    if (deliveries.length === 0) {
        return null;
    }

    const describe = (delivery: IntegrationDelivery): string => {
        const channel = deliveryChannelLabel(delivery.channel, t);

        if (delivery.status === 'queued') {
            return t('Sending to :channel…', { channel });
        }

        if (delivery.status === 'failed') {
            return t(':channel: failed — :error', {
                channel,
                error:
                    delivery.error ??
                    t('Something went wrong. Please try again.'),
            });
        }

        const at = delivery.sentAt ?? delivery.createdAt;
        const time =
            isMounted && at ? formatRelativeTime(at, locale, Date.now()) : '';

        if (delivery.channel === 'email') {
            const count = delivery.recipientCount ?? 0;

            if (!time) {
                return count === 1
                    ? t('Emailed to 1 person')
                    : t('Emailed to :count people', { count });
            }

            return count === 1
                ? t('Emailed to 1 person · :time', { time })
                : t('Emailed to :count people · :time', { count, time });
        }

        if (!time) {
            return t('Sent to :channel', { channel });
        }

        return t('Sent to :channel · :time', { channel, time });
    };

    return (
        <ul
            className="space-y-0.5 text-xs text-muted-foreground"
            aria-live="polite"
        >
            {deliveries.map((delivery) => (
                <li
                    key={delivery.id}
                    className={
                        delivery.status === 'failed'
                            ? 'text-destructive'
                            : undefined
                    }
                >
                    {describe(delivery)}
                </li>
            ))}
        </ul>
    );
}
