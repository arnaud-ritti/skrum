import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationStatusesController from '@/actions/App/Http/Controllers/Integrations/IntegrationStatusesController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, TeamIntegration, TrackerStatus } from '@/types';

const Automatic = 'automatic';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

/**
 * Spec 8 §5.2: per project (Jira) or team (Linear) of the tracked issues,
 * which statuses count as done and where a push moves the issue.
 */
export function StatusMappingPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [containers, setContainers] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
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
                    setError(null);
                }
            })
            .catch((failure: unknown) => {
                if (!cancelled) {
                    setError(
                        integrationErrorMessage(
                            failure,
                            t('Something went wrong.'),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace, team, integration, t, attempt]);

    const retry = () => {
        setError(null);
        setAttempt((previous) => previous + 1);
    };

    return (
        <div className="space-y-2">
            <div>
                <h4 className="text-sm font-medium">{t('Status mapping')}</h4>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Automatic uses the done statuses of each workflow. Choose other statuses per project or team if yours differ.',
                    )}
                </p>
            </div>
            {error !== null && (
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button size="sm" variant="outline" onClick={retry}>
                        {t('Try again')}
                    </Button>
                </div>
            )}
            {containers === null && error === null && <Spinner />}
            {containers !== null && containers.length === 0 && (
                <p className="text-xs text-muted-foreground">
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
        </div>
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
              complete_status_id: jira?.completeStatusId ?? null,
              reopen_status_id: jira?.reopenStatusId ?? null,
          }
        : {
              complete_state_id: linear?.completeStateId ?? null,
              reopen_state_id: linear?.reopenStateId ?? null,
          };
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
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{label}</p>
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
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{container}</span>
                {statuses === null && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void load()}
                    >
                        {t('Edit mapping')}
                    </Button>
                )}
            </div>
            {statuses !== null && (
                <>
                    {isJira && doneStatuses.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                                {t('Counts as done')}
                            </p>
                            {doneStatuses.map((status) => (
                                <label
                                    key={status.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={checkedDoneIds.includes(
                                            status.id,
                                        )}
                                        disabled={
                                            busy ||
                                            (lastDoneChecked &&
                                                checkedDoneIds.includes(
                                                    status.id,
                                                ))
                                        }
                                        onCheckedChange={(checked) =>
                                            toggleDone(
                                                status.id,
                                                checked === true,
                                            )
                                        }
                                    />
                                    {status.name}
                                </label>
                            ))}
                            {lastDoneChecked && (
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'At least one status must count as done.',
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                        {targetSelect(completeKey, t('Complete to'))}
                        {targetSelect(reopenKey, t('Reopen to'))}
                    </div>
                </>
            )}
        </div>
    );
}
