import { router, usePoll } from '@inertiajs/react';
import { Check, Copy, ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TelegramConnectCodesController from '@/actions/App/Http/Controllers/Integrations/TelegramConnectCodesController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';
import type { DisconnectControl } from './provider-card';

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
        connection.settings.linkedAt ?? '',
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

    /** A command sent just before the expiry may have connected the chat: one last look. */
    useEffect(() => {
        if (expired) {
            stop();
            router.reload({ only: ['providers'] });
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
        <LoadingButton
            type="button"
            size="sm"
            variant={connection === null ? 'default' : 'outline'}
            className="max-w-full"
            data-test="integration-connect"
            loading={busy}
            disabled={telegram?.botUsername === null}
            onClick={() => void createCode()}
        >
            <span className="truncate">
                {connection === null ? t('Connect') : t('Connect another chat')}
            </span>
        </LoadingButton>
    );

    const disconnect =
        connection === null
            ? undefined
            : (control?: DisconnectControl) => (
                  <DisconnectIntegrationDialog
                      scope={scope}
                      card={card}
                      connection={connection}
                      description={
                          connection.settings.chatTitle
                              ? t(
                                    'The bot leaves :chat and nothing is posted there anymore.',
                                    { chat: connection.settings.chatTitle },
                                )
                              : t(
                                    'The bot leaves the chat and nothing is posted there anymore.',
                                )
                      }
                      control={control}
                  />
              );

    const botTroubles = [
        telegram?.conflict
            ? t(
                  'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.',
              )
            : null,
        telegram?.botUsername === null
            ? t(
                  'Telegram did not answer. Check the bot token of this instance.',
              )
            : null,
    ].filter((trouble): trouble is string => trouble !== null);

    return (
        <ProviderCard
            {...providerCardProps(card, Send, t)}
            notice={botTroubles.length === 0 ? null : botTroubles.join(' ')}
            disconnect={disconnect}
            details={
                connection !== null && (
                    <ProviderDetails
                        connection={connection}
                        rows={[
                            {
                                label: t('Chat'),
                                value: connection.settings.chatTitle,
                            },
                        ]}
                    />
                )
            }
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
                        {disconnect?.()}
                    </>
                )
            }
        >
            {botTroubles.map((trouble) => (
                <Alert key={trouble} variant="warning" title={trouble} />
            ))}
            {connection === null && (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Post board links and results to a Telegram group, channel or private chat.',
                    )}
                </p>
            )}
            {pending !== null && !connectedSinceCode && (
                <div
                    data-slot="telegram-pending-code"
                    className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/50 p-4 text-sm"
                >
                    <p>
                        {t(
                            'Add the bot to your group or channel (as an administrator for channels) or open a private chat with it, then send this command:',
                        )}
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 basis-64 rounded-md border bg-card px-2.5 py-1.5 font-mono break-all">
                            {pending.code.command}
                        </code>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copy(pending.code.command)}
                        >
                            {copied === pending.code.command ? (
                                <Check aria-hidden="true" />
                            ) : (
                                <Copy aria-hidden="true" />
                            )}
                            <span className="truncate">
                                {copied === pending.code.command
                                    ? t('Copied')
                                    : t('Copy')}
                            </span>
                        </Button>
                    </div>
                    <a
                        href={`https://t.me/${pending.code.botUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 self-start rounded-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <span className="min-w-0 break-words">
                            {t('Open @:bot in Telegram', {
                                bot: pending.code.botUsername,
                            })}
                        </span>
                        <ExternalLink
                            className="size-3 shrink-0"
                            aria-hidden="true"
                        />
                    </a>
                    <p
                        data-slot="telegram-pending-state"
                        className={
                            expired
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground'
                        }
                    >
                        {expired
                            ? t('This code has expired. Create a new one.')
                            : t('Waiting for the command… (:time left)', {
                                  time: formatSeconds(remaining ?? 0),
                              })}
                    </p>
                </div>
            )}
        </ProviderCard>
    );
}
