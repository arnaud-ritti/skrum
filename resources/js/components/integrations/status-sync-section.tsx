import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Checkbox } from '@/components/ui/checkbox';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import { JiraDataCenterWebhookPanel } from './jira-data-center-webhook-panel';
import { StatusMappingPanel } from './status-mapping-panel';

type Props = {
    scope: IntegrationScope;
    card: IntegrationProviderCard;
    connection: TeamIntegration;
};

/**
 * Spec 8 §9: opt-in two-way status sync of a tracker connection.
 */
export function StatusSyncSection({ scope, card, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { pollMinutes } = usePage<{ pollMinutes?: number }>().props;
    const [busy, setBusy] = useState(false);
    const minutes = pollMinutes ?? 5;
    const treatsCanceled =
        connection.provider === 'linear' || connection.provider === 'github';
    const mapsStatuses =
        connection.provider === 'jira' ||
        connection.provider === 'jira_dc' ||
        connection.provider === 'linear';
    const lastSync = [connection.lastPolledAt, connection.lastInboundAt]
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1);

    const save = async (data: Record<string, unknown>, success: string) => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    workspace: scope.workspace,
                    team: scope.team,
                    integration: connection.id,
                }),
                data,
            );
            toast.success(success);
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const modeLine = (): string => {
        if (
            connection.inboundMode === 'webhook' &&
            connection.webhookStatus === 'failing'
        ) {
            return t(
                "Webhooks aren't reaching skrum; checking every :n minutes.",
                { n: minutes },
            );
        }

        if (connection.inboundMode === 'webhook') {
            return t('Live updates (webhooks)');
        }

        return t('Checking every :n minutes.', { n: minutes });
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <div>
                <h3 className="text-sm font-medium">{t('Status sync')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Completing an action item moves its :provider issue to done, and closing the issue completes the item. Imported poker tasks follow their issue.',
                        { provider: card.label },
                    )}
                </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
                <Checkbox
                    checked={connection.statusSync}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                        void save(
                            { status_sync: checked === true },
                            checked === true
                                ? t('Status sync is on.')
                                : t('Status sync is off.'),
                        )
                    }
                />
                {t('Sync status')}
            </label>
            {connection.statusSync && (
                <>
                    <p className="text-sm text-muted-foreground">
                        {modeLine()}
                    </p>
                    {lastSync !== undefined && (
                        <p className="text-xs text-muted-foreground">
                            {t('Last sync: :time', {
                                time: new Intl.DateTimeFormat(locale, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                }).format(new Date(lastSync)),
                            })}
                        </p>
                    )}
                    {connection.inboundHint === 'reconnect' && (
                        <p className="text-xs text-muted-foreground">
                            {t('Reconnect :provider to receive live updates.', {
                                provider: card.label,
                            })}
                        </p>
                    )}
                    {connection.inboundHint === 'manual' && (
                        <JiraDataCenterWebhookPanel
                            scope={scope}
                            connection={connection}
                        />
                    )}
                    {treatsCanceled && (
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={
                                    connection.settings.treatCanceledAsDone !==
                                    false
                                }
                                disabled={busy}
                                onCheckedChange={(checked) =>
                                    void save(
                                        {
                                            treat_canceled_as_done:
                                                checked === true,
                                        },
                                        t('Status sync setting saved.'),
                                    )
                                }
                            />
                            {t('Treat canceled as done')}
                        </label>
                    )}
                    {mapsStatuses && (
                        <StatusMappingPanel
                            scope={scope}
                            connection={connection}
                        />
                    )}
                </>
            )}
        </section>
    );
}
