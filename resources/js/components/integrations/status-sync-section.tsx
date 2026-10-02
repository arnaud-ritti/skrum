import { router, usePage } from '@inertiajs/react';
import { Clock, Radio, RefreshCw, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogIcon,
    DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    StatusSyncPageProps,
    TeamIntegration,
} from '@/types';
import { JiraDataCenterWebhookPanel } from './jira-data-center-webhook-panel';
import { StatusMappingPanel } from './status-mapping-panel';
import { TrackerPanel } from './tracker-parts';

type Props = {
    scope: IntegrationScope;
    card: IntegrationProviderCard;
    connection: TeamIntegration;
};

type Mode = { icon: LucideIcon; line: string; failing: boolean };

/**
 * An option of the sync: its name on the left, its switch on the right. The
 * switch sits inside the label, which the browser suite reads.
 */
function OptionSwitch({
    children,
    ...props
}: {
    children: ReactNode;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <label
            className={cn(
                'flex min-w-0 items-center justify-between gap-3 text-sm font-medium',
                props.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
        >
            <span className="min-w-0">{children}</span>
            <Switch {...props} />
        </label>
    );
}

/**
 * Spec 8 §9: opt-in two-way status sync of a tracker connection.
 */
export function StatusSyncSection({ scope, card, connection }: Props) {
    const { t } = useTrans();
    const { locale, pollMinutes } = usePage<StatusSyncPageProps>().props;
    const [busy, setBusy] = useState(false);
    const [confirmingOn, setConfirmingOn] = useState(false);
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

    const mode = (): Mode => {
        const listens = connection.inboundMode === 'webhook';

        if (listens && connection.webhookStatus === 'failing') {
            return {
                icon: TriangleAlert,
                line: t(
                    "Webhooks aren't reaching skrum; checking every :n minutes.",
                    { n: pollMinutes },
                ),
                failing: true,
            };
        }

        if (listens && connection.webhookStatus === 'active') {
            return {
                icon: Radio,
                line: t('Live updates (webhooks)'),
                failing: false,
            };
        }

        if (listens && connection.webhookStatus === 'pending') {
            return {
                icon: Radio,
                line: t('Setting up live updates…'),
                failing: false,
            };
        }

        return {
            icon: Clock,
            line: t('Checking every :n minutes.', { n: pollMinutes }),
            failing: false,
        };
    };

    const { icon: ModeIcon, line, failing } = mode();

    return (
        <TrackerPanel
            slot="status-sync"
            title={t('Status sync')}
            description={t(
                'Completing an action item moves its :provider issue to done, and closing the issue completes the item. Imported poker tasks follow their issue.',
                { provider: card.label },
            )}
        >
            <OptionSwitch
                checked={connection.statusSync}
                disabled={busy}
                onCheckedChange={(checked) => {
                    if (checked) {
                        setConfirmingOn(true);

                        return;
                    }

                    void save({ status_sync: false }, t('Status sync is off.'));
                }}
            >
                {t('Sync status')}
            </OptionSwitch>
            <Dialog open={confirmingOn} onOpenChange={setConfirmingOn}>
                <DialogContent size="sm" showCloseButton={false}>
                    <DialogHeader>
                        <DialogIcon>
                            <RefreshCw />
                        </DialogIcon>
                        <DialogTitle>
                            {t('Turn on status sync with :provider?', {
                                provider: card.label,
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'The first sync takes the state of every linked :provider issue: existing action items may be completed or reopened to match. After that, the most recent change wins.',
                                { provider: card.label },
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmingOn(false)}
                        >
                            <span className="truncate">{t('Cancel')}</span>
                        </Button>
                        <Button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setConfirmingOn(false);
                                void save(
                                    { status_sync: true },
                                    t('Status sync is on.'),
                                );
                            }}
                        >
                            <span className="truncate">
                                {t('Turn on status sync')}
                            </span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {connection.statusSync && (
                <>
                    <div
                        data-slot="status-sync-mode"
                        data-failing={failing ? 'true' : undefined}
                        className="flex min-w-0 items-start gap-2.5 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm"
                    >
                        <ModeIcon
                            aria-hidden="true"
                            className={cn(
                                'mt-0.5 size-4 shrink-0',
                                failing
                                    ? 'text-skrum-warning-text'
                                    : 'text-muted-foreground',
                            )}
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <p className="font-medium">{line}</p>
                            {lastSync !== undefined && (
                                <p className="text-body-sm text-muted-foreground">
                                    {t('Last sync: :time', {
                                        time: new Intl.DateTimeFormat(locale, {
                                            dateStyle: 'medium',
                                            timeStyle: 'short',
                                        }).format(new Date(lastSync)),
                                    })}
                                </p>
                            )}
                            {connection.inboundHint === 'reconnect' && (
                                <p className="text-body-sm text-muted-foreground">
                                    {t(
                                        'Reconnect :provider to receive live updates.',
                                        { provider: card.label },
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    {connection.inboundHint === 'manual' && (
                        <JiraDataCenterWebhookPanel
                            scope={scope}
                            connection={connection}
                        />
                    )}
                    {treatsCanceled && (
                        <OptionSwitch
                            checked={
                                connection.settings.treatCanceledAsDone !==
                                false
                            }
                            disabled={busy}
                            onCheckedChange={(checked) =>
                                void save(
                                    { treat_canceled_as_done: checked },
                                    t('Status sync setting saved.'),
                                )
                            }
                        >
                            {t('Treat canceled as done')}
                        </OptionSwitch>
                    )}
                    {mapsStatuses && (
                        <StatusMappingPanel
                            scope={scope}
                            connection={connection}
                        />
                    )}
                </>
            )}
        </TrackerPanel>
    );
}
