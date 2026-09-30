import { RetroRequestError } from '@/lib/retro/api';
import type { DeliveryChannel, ShareChannel } from '@/types';

export function integrationErrorMessage(
    error: unknown,
    fallback: string,
): string {
    if (error instanceof RetroRequestError && error.status !== 0) {
        return error.message;
    }

    return fallback;
}

export const ShareChannels: ShareChannel[] = ['slack', 'telegram'];

export function deliveryChannelLabel(
    channel: DeliveryChannel,
    t: (key: string) => string,
): string {
    switch (channel) {
        case 'slack':
            return 'Slack';
        case 'telegram':
            return 'Telegram';
        case 'email':
            return t('Email');
    }
}
