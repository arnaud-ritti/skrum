import { router } from '@inertiajs/react';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import TrackerWebhooksController from '@/actions/App/Http/Controllers/Integrations/TrackerWebhooksController';
import { LoadingButton } from '@/components/skrum/loading-button';
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

const CopiedMs = 2_000;

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

type Pending = 'details' | 'registration' | null;

/**
 * Spec 8 §4.1: Data Center webhooks need a Jira administrator. The URL
 * (with its token) and the secret are fetched on demand, never kept in
 * page props.
 */
export function JiraDataCenterWebhookPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [details, setDetails] = useState<TrackerWebhookDetails | null>(null);
    const [pending, setPending] = useState<Pending>(null);
    const params = {
        workspace: scope.workspace,
        team: scope.team,
        integration: connection.id,
    };

    const show = async () => {
        setPending('details');

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
            setPending(null);
        }
    };

    const confirm = async () => {
        setPending('registration');

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
            setPending(null);
        }
    };

    return (
        <div
            data-slot="tracker-webhook"
            className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/50 p-4 text-sm"
        >
            <p>
                {t(
                    'Only a Jira administrator can register the webhook. Ask one to add it in Jira (System → WebHooks) with these details.',
                )}
            </p>
            {details !== null && (
                <dl className="flex min-w-0 flex-col gap-3">
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
            {(details === null || connection.webhookStatus === null) && (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {details === null && (
                        <LoadingButton
                            type="button"
                            size="sm"
                            variant="outline"
                            className="max-w-full"
                            loading={pending === 'details'}
                            disabled={pending !== null}
                            onClick={() => void show()}
                        >
                            <span className="truncate">
                                {t('Show webhook details')}
                            </span>
                        </LoadingButton>
                    )}
                    {connection.webhookStatus === null && (
                        <LoadingButton
                            type="button"
                            size="sm"
                            className="max-w-full"
                            loading={pending === 'registration'}
                            disabled={pending !== null}
                            onClick={() => void confirm()}
                        >
                            <span className="truncate">
                                {t("I've registered it")}
                            </span>
                        </LoadingButton>
                    )}
                </div>
            )}
        </div>
    );
}

function CopyRow({ label, value }: { label: string; value: string }) {
    const { t } = useTrans();
    const [, copy] = useClipboard();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timer = setTimeout(() => setCopied(false), CopiedMs);

        return () => clearTimeout(timer);
    }, [copied]);

    const copyValue = async () => {
        if (await copy(value)) {
            setCopied(true);
            toast.success(t(':label copied.', { label }));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
    };

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-body-sm text-muted-foreground">{label}</dt>
            <dd className="flex min-w-0 items-start gap-2">
                <code className="min-w-0 flex-1 rounded-md border bg-card px-2.5 py-1.5 font-mono text-xs break-all">
                    {value}
                </code>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0"
                    aria-label={t('Copy :label', { label })}
                    onClick={() => void copyValue()}
                >
                    {copied ? (
                        <Check aria-hidden="true" />
                    ) : (
                        <Copy aria-hidden="true" />
                    )}
                </Button>
            </dd>
        </div>
    );
}
