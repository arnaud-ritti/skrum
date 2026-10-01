import { router } from '@inertiajs/react';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import TrackerWebhooksController from '@/actions/App/Http/Controllers/Integrations/TrackerWebhooksController';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    TeamIntegration,
    TrackerWebhookDetails,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

/**
 * Spec 8 §4.1: Data Center webhooks need a Jira administrator. The URL
 * (with its token) and the secret are fetched on demand, never kept in
 * page props.
 */
export function JiraDataCenterWebhookPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [details, setDetails] = useState<TrackerWebhookDetails | null>(null);
    const [busy, setBusy] = useState(false);
    const params = {
        workspace: scope.workspace,
        team: scope.team,
        integration: connection.id,
    };

    const show = async () => {
        setBusy(true);

        try {
            setDetails(
                await retroRequest<TrackerWebhookDetails>(
                    TrackerWebhooksController.show(params),
                ),
            );
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const confirm = async () => {
        setBusy(true);

        try {
            await retroRequest(TrackerWebhooksController.store(params), {
                registered: true,
            });
            toast.success(t('skrum now waits for the first event.'));
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
            <p>
                {t(
                    'Only a Jira administrator can register the webhook. Ask one to add it in Jira (System → WebHooks) with these details.',
                )}
            </p>
            {details === null ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void show()}
                >
                    {t('Show webhook details')}
                </Button>
            ) : (
                <dl className="space-y-2">
                    <CopyRow label={t('Webhook URL')} value={details.url} />
                    <CopyRow
                        label={t('Events')}
                        value={details.events.join(', ')}
                    />
                    {details.jql !== null && (
                        <CopyRow label={t('JQL filter')} value={details.jql} />
                    )}
                    <CopyRow
                        label={t('Secret (for Jira versions that sign)')}
                        value={details.secret}
                    />
                </dl>
            )}
            {connection.webhookStatus === null && (
                <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void confirm()}
                >
                    {t("I've registered it")}
                </Button>
            )}
        </div>
    );
}

function CopyRow({ label, value }: { label: string; value: string }) {
    const { t } = useTrans();
    const [, copy] = useClipboard();

    const copyValue = async () => {
        if (await copy(value)) {
            toast.success(t(':label copied.', { label }));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                    {value}
                </code>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t('Copy :label', { label })}
                    onClick={() => void copyValue()}
                >
                    <Copy className="size-3.5" />
                </Button>
            </dd>
        </div>
    );
}
