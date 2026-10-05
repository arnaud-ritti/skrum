import { usePage } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { deliveryChannelLabel } from '@/lib/integrations';
import type { IntegrationDelivery } from '@/types';

type Props = {
    deliveries: IntegrationDelivery[];
};

const MinuteMs = 60_000;

function subscribeToMinutes(onMinute: () => void): () => void {
    const timer = window.setInterval(onMinute, MinuteMs);

    return () => window.clearInterval(timer);
}

/** The current minute, null on the server and during hydration: the relative times follow the clock. */
function useMinute(): number | null {
    return useSyncExternalStore(
        subscribeToMinutes,
        () => Math.floor(Date.now() / MinuteMs),
        () => null,
    );
}

export function DeliveryLines({ deliveries }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const minute = useMinute();

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
            minute !== null && at
                ? formatRelativeTime(at, locale, minute * MinuteMs)
                : '';

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
        <div data-slot="delivery-lines" aria-live="polite" className="contents">
            {deliveries.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
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
            )}
        </div>
    );
}
