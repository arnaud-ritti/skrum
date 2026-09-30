import { usePoll } from '@inertiajs/react';
import { Copy, ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TelegramConnectCodesController from '@/actions/App/Http/Controllers/Integrations/TelegramConnectCodesController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useClipboard } from '@/hooks/use-clipboard';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TelegramBotInfo,
    TelegramConnectCode,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    telegram: TelegramBotInfo | null;
};

type PendingCode = {
    code: TelegramConnectCode;
    connectionIdentity: string | null;
};

/**
 * Saving a connection can change these; a test message only touches
 * lastCheckedAt, so it must not count as a new connection.
 */
function connectionIdentity(
    connection: IntegrationProviderCard['connection'],
): string | null {
    if (connection === null) {
        return null;
    }

    return [
        connection.id,
        connection.status,
        connection.settings.chatId ?? '',
        connection.connectedBy ?? '',
    ].join('|');
}

export function TelegramIntegration({ card, scope, telegram }: Props) {
    const { t } = useTrans();
    const connection = card.connection;
    const [pending, setPending] = useState<PendingCode | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, copy] = useClipboard();
    const remaining = useCountdown(pending?.code.expiresAt ?? null, 0);
    const { start, stop } = usePoll(
        5000,
        { only: ['providers'] },
        { autoStart: false },
    );

    const connectedSinceCode =
        pending !== null &&
        connection?.status === 'active' &&
        connectionIdentity(connection) !== pending.connectionIdentity;
    const expired = pending !== null && remaining === 0;

    useEffect(() => {
        if (connectedSinceCode) {
            stop();
            toast.success(t('Telegram connected.'));
        }
    }, [connectedSinceCode, stop, t]);

    useEffect(() => {
        if (expired) {
            stop();
        }
    }, [expired, stop]);

    const createCode = async () => {
        setBusy(true);

        try {
            const code = await retroRequest<TelegramConnectCode>(
                TelegramConnectCodesController.store(scope),
            );
            setPending({
                code,
                connectionIdentity: connectionIdentity(connection),
            });
            start();
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const connectButton = (
        <Button
            size="sm"
            variant={connection === null ? 'default' : 'outline'}
            disabled={busy || telegram?.botUsername === null}
            onClick={() => void createCode()}
        >
            {busy && <Spinner />}
            {connection === null ? t('Connect') : t('Connect another chat')}
        </Button>
    );

    return (
        <IntegrationCard
            icon={Send}
            card={card}
            actions={
                connection === null ? (
                    connectButton
                ) : (
                    <>
                        {connectButton}
                        {connection.status === 'active' && (
                            <TestConnectionButton
                                scope={scope}
                                connection={connection}
                                label={t('Send a test message')}
                                successMessage={t('Test message sent.')}
                            />
                        )}
                        <DisconnectIntegrationDialog
                            scope={scope}
                            card={card}
                            connection={connection}
                            description={t(
                                'The bot leaves :chat and nothing is posted there anymore.',
                                { chat: connection.settings.chatTitle ?? '' },
                            )}
                        />
                    </>
                )
            }
        >
            {telegram?.conflict && (
                <p className="text-sm text-destructive">
                    {t(
                        'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.',
                    )}
                </p>
            )}
            {telegram?.botUsername === null && (
                <p className="text-sm text-destructive">
                    {t(
                        'Telegram did not answer. Check the bot token of this instance.',
                    )}
                </p>
            )}
            {connection === null ? (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Post board links and results to a Telegram group, channel or private chat.',
                    )}
                </p>
            ) : (
                <IntegrationDetails
                    connection={connection}
                    rows={[
                        {
                            label: t('Chat'),
                            value: connection.settings.chatTitle,
                        },
                    ]}
                />
            )}
            {pending !== null && !connectedSinceCode && (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                    <p>
                        {t(
                            'Add the bot to your group or channel (as an administrator for channels) or open a private chat with it, then send this command:',
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 rounded bg-muted px-2 py-1 font-mono break-all">
                            {pending.code.command}
                        </code>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copy(pending.code.command)}
                        >
                            <Copy className="size-4" aria-hidden />
                            {copied === pending.code.command
                                ? t('Copied')
                                : t('Copy')}
                        </Button>
                    </div>
                    <a
                        href={`https://t.me/${pending.code.botUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline"
                    >
                        {t('Open @:bot in Telegram', {
                            bot: pending.code.botUsername,
                        })}
                        <ExternalLink className="size-3" aria-hidden />
                    </a>
                    <p className="text-muted-foreground">
                        {expired
                            ? t('This code has expired. Create a new one.')
                            : t('Waiting for the command… (:time left)', {
                                  time: formatSeconds(remaining ?? 0),
                              })}
                    </p>
                </div>
            )}
        </IntegrationCard>
    );
}
