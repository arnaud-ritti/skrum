import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationStatusesController from '@/actions/App/Http/Controllers/Integrations/IntegrationStatusesController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, TeamIntegration, TrackerStatus } from '@/types';
import { PanelError, PanelLoading, TrackerPanel } from './tracker-parts';

const Automatic = 'automatic';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

type Failure = { error: unknown };

/**
 * Spec 8 §5.2: per project (Jira) or team (Linear) of the tracked issues,
 * which statuses count as done and where a push moves the issue.
 */
export function StatusMappingPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [containers, setContainers] = useState<string[] | null>(null);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [attempt, setAttempt] = useState(0);
    const { workspace, team } = scope;
    const integration = connection.id;

    useEffect(() => {
        let cancelled = false;

        retroRequest<{ containers: string[] }>(
            IntegrationStatusesController.index({
                workspace,
                team,
                integration,
            }),
        )
            .then((loaded) => {
                if (!cancelled) {
                    setContainers(loaded.containers);
                    setFailure(null);
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setFailure({ error });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, attempt]);

    const retry = () => {
        setFailure(null);
        setAttempt((previous) => previous + 1);
    };

    return (
        <TrackerPanel
            nested
            slot="status-mapping"
            title={t('Status mapping')}
            description={t(
                'Automatic uses the done statuses of each workflow. Choose other statuses per project or team if yours differ.',
            )}
        >
            {failure !== null && (
                <PanelError
                    message={integrationErrorMessage(
                        failure.error,
                        t('Something went wrong.'),
                    )}
                    retryLabel={t('Try again')}
                    onRetry={retry}
                />
            )}
            {containers === null && failure === null && (
                <PanelLoading rows={2} />
            )}
            {containers !== null && containers.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-body-sm text-muted-foreground">
                    {t(
                        'Export an action item or import a task to map its statuses.',
                    )}
                </p>
            )}
            {containers?.map((container) => (
                <ContainerMapping
                    key={container}
                    scope={scope}
                    connection={connection}
                    container={container}
                />
            ))}
        </TrackerPanel>
    );
}

function ContainerMapping({
    scope,
    connection,
    container,
}: Props & { container: string }) {
    const { t } = useTrans();
    const [statuses, setStatuses] = useState<TrackerStatus[] | null>(null);
    const [busy, setBusy] = useState(false);
    const isJira = connection.provider !== 'linear';
    const jira = connection.settings.statusMapping?.projects?.[container];
    const linear = connection.settings.statusMapping?.teams?.[container];
    const params = {
        workspace: scope.workspace,
        team: scope.team,
        integration: connection.id,
    };
    const current: Record<string, string | string[] | null> = isJira
        ? {
              done_status_ids: jira?.doneStatusIds ?? null,
              start_status_id: jira?.startStatusId ?? null,
              complete_status_id: jira?.completeStatusId ?? null,
              reopen_status_id: jira?.reopenStatusId ?? null,
          }
        : {
              start_state_id: linear?.startStateId ?? null,
              complete_state_id: linear?.completeStateId ?? null,
              reopen_state_id: linear?.reopenStateId ?? null,
          };
    const startKey = isJira ? 'start_status_id' : 'start_state_id';
    const completeKey = isJira ? 'complete_status_id' : 'complete_state_id';
    const reopenKey = isJira ? 'reopen_status_id' : 'reopen_state_id';
    const doneStatuses = (statuses ?? []).filter(
        (status) => status.category === 'done',
    );
    const allDoneIds = doneStatuses.map((status) => status.id);
    const savedDoneIds = jira?.doneStatusIds ?? null;
    const checkedDoneIds =
        savedDoneIds === null
            ? allDoneIds
            : allDoneIds.filter((id) => savedDoneIds.includes(id));
    const lastDoneChecked = checkedDoneIds.length === 1;

    const load = async () => {
        setBusy(true);

        try {
            const loaded = await retroRequest<{ statuses: TrackerStatus[] }>(
                IntegrationStatusesController.index(params, {
                    query: { container },
                }),
            );
            setStatuses(loaded.statuses);
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const save = async (change: Record<string, string | string[] | null>) => {
        setBusy(true);

        try {
            await retroRequest(TeamIntegrationsController.update(params), {
                status_mapping: { container, ...current, ...change },
            });
            toast.success(t('Status mapping saved.'));
            router.reload({ only: ['providers'] });
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const toggleDone = (id: string, checked: boolean) => {
        const next = allDoneIds.filter((doneId) =>
            doneId === id ? checked : checkedDoneIds.includes(doneId),
        );

        if (next.length === 0) {
            return;
        }

        const countsEveryDoneStatus = allDoneIds.every((doneId) =>
            next.includes(doneId),
        );

        void save({
            done_status_ids: countsEveryDoneStatus ? null : next,
        });
    };

    const targetSelect = (key: string, label: string) => {
        const value = (current[key] as string | null) ?? Automatic;
        const isUnknown =
            value !== Automatic &&
            !(statuses ?? []).some((status) => status.id === value);

        return (
            <div className="flex min-w-0 flex-col gap-1.5">
                <span aria-hidden="true" className="text-sm font-medium">
                    {label}
                </span>
                <Select
                    value={value}
                    disabled={busy}
                    onValueChange={(selected) =>
                        void save({
                            [key]: selected === Automatic ? null : selected,
                        })
                    }
                >
                    <SelectTrigger className="w-full" aria-label={label}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={Automatic}>
                            {t('Automatic')}
                        </SelectItem>
                        {isUnknown && (
                            <SelectItem value={value}>
                                {t('Unknown status (:id)', { id: value })}
                            </SelectItem>
                        )}
                        {(statuses ?? []).map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                                {status.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    };

    return (
        <div
            data-slot="status-mapping-container"
            className="flex min-w-0 flex-col gap-3 rounded-lg border p-3"
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 font-mono text-sm font-medium break-all">
                    {container}
                </span>
                {statuses === null && (
                    <LoadingButton
                        type="button"
                        size="sm"
                        variant="outline"
                        className="max-w-full"
                        loading={busy}
                        onClick={() => void load()}
                    >
                        <span className="truncate">{t('Edit mapping')}</span>
                    </LoadingButton>
                )}
            </div>
            {statuses !== null && (
                <>
                    {isJira && doneStatuses.length > 0 && (
                        <fieldset className="flex min-w-0 flex-col gap-1.5">
                            <legend className="mb-1.5 text-sm font-medium">
                                {t('Counts as done')}
                            </legend>
                            {doneStatuses.map((status) => (
                                <Checkbox
                                    key={status.id}
                                    label={status.name}
                                    checked={checkedDoneIds.includes(status.id)}
                                    disabled={
                                        busy ||
                                        (lastDoneChecked &&
                                            checkedDoneIds.includes(status.id))
                                    }
                                    onCheckedChange={(checked) =>
                                        toggleDone(status.id, checked === true)
                                    }
                                />
                            ))}
                            {lastDoneChecked && (
                                <p className="text-body-sm text-muted-foreground">
                                    {t(
                                        'At least one status must count as done.',
                                    )}
                                </p>
                            )}
                        </fieldset>
                    )}
                    <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
                        {targetSelect(startKey, t('Start to'))}
                        {targetSelect(completeKey, t('Complete to'))}
                        {targetSelect(reopenKey, t('Reopen to'))}
                    </div>
                </>
            )}
        </div>
    );
}
