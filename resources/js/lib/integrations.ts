import type { Translate } from '@/hooks/use-trans';
import { RetroRequestError } from '@/lib/retro/api';
import type { DeliveryChannel, ShareAvailability, ShareChannel } from '@/types';

export function integrationErrorMessage(
    error: unknown,
    fallback: string,
): string {
    if (error instanceof RetroRequestError && error.status !== 0) {
        return error.message;
    }

    return fallback;
}

export const ShareChannels: ShareChannel[] = [
    'slack',
    'telegram',
    'msteams',
    'mattermost',
    'webhook',
];

export function enabledShareChannels(
    availability: ShareAvailability,
): ShareChannel[] {
    return ShareChannels.filter((channel) => availability[channel]);
}

export function hasShareChannel(availability: ShareAvailability): boolean {
    return ShareChannels.some((channel) => availability[channel]);
}

export function deliveryChannelLabel(
    channel: DeliveryChannel,
    t: Translate,
): string {
    switch (channel) {
        case 'slack':
            return 'Slack';
        case 'telegram':
            return 'Telegram';
        case 'msteams':
            return 'Microsoft Teams';
        case 'mattermost':
            return 'Mattermost';
        case 'webhook':
            return t('Webhook');
        case 'email':
            return t('Email');
    }
}

export function postLinkLabel(channel: ShareChannel, t: Translate): string {
    switch (channel) {
        case 'slack':
            return t('Post link to Slack');
        case 'telegram':
            return t('Post link to Telegram');
        case 'msteams':
            return t('Post link to Microsoft Teams');
        case 'mattermost':
            return t('Post link to Mattermost');
        case 'webhook':
            return t('Send link to webhook');
    }
}

export function shareResultsLabel(channel: ShareChannel, t: Translate): string {
    switch (channel) {
        case 'slack':
            return t('Share to Slack');
        case 'telegram':
            return t('Share to Telegram');
        case 'msteams':
            return t('Share to Microsoft Teams');
        case 'mattermost':
            return t('Share to Mattermost');
        case 'webhook':
            return t('Send to webhook');
    }
}

export function recapDialogTitle(channel: ShareChannel, t: Translate): string {
    switch (channel) {
        case 'slack':
            return t('Share the results to Slack');
        case 'telegram':
            return t('Share the results to Telegram');
        case 'msteams':
            return t('Share the results to Microsoft Teams');
        case 'mattermost':
            return t('Share the results to Mattermost');
        case 'webhook':
            return t('Send the results to the webhook');
    }
}
