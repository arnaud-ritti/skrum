import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { ShareChannels } from '@/lib/integrations';
import type {
    IntegrationDelivery,
    ShareAvailability,
    ShareChannel,
} from '@/types';
import { DeliveryLines } from './delivery-lines';

type Props = {
    availability: ShareAvailability;
    guestLinkAvailable: boolean;
    guestLinkLabel: string;
    deliveries: IntegrationDelivery[];
    onPost: (
        channel: ShareChannel,
        includeGuestLink: boolean,
    ) => Promise<boolean>;
    hint?: string;
};

export function PostLinkSection({
    availability,
    guestLinkAvailable,
    guestLinkLabel,
    deliveries,
    onPost,
    hint,
}: Props) {
    const { t } = useTrans();
    const checkboxId = useId();
    const [includeGuestLink, setIncludeGuestLink] = useState(false);
    const [busy, setBusy] = useState<ShareChannel | null>(null);
    const channels = ShareChannels.filter((channel) => availability[channel]);

    if (channels.length === 0) {
        return null;
    }

    const post = async (channel: ShareChannel) => {
        setBusy(channel);

        let posted = false;

        try {
            posted = await onPost(
                channel,
                guestLinkAvailable && includeGuestLink,
            );
        } finally {
            setBusy(null);
        }

        if (posted) {
            toast(t('The message is on its way.'));
        }
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">{t('Post a link')}</h3>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {guestLinkAvailable && (
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={checkboxId}
                        checked={includeGuestLink}
                        onCheckedChange={(checked) =>
                            setIncludeGuestLink(checked === true)
                        }
                    />
                    <Label htmlFor={checkboxId}>{guestLinkLabel}</Label>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                    <Button
                        key={channel}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void post(channel)}
                    >
                        {channel === 'slack'
                            ? t('Post link to Slack')
                            : t('Post link to Telegram')}
                    </Button>
                ))}
            </div>
            <DeliveryLines deliveries={deliveries} />
        </section>
    );
}
