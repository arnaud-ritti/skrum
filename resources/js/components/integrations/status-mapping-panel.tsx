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
    }, [workspace, team, integration, t]);

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
                <p className="text-sm text-destructive">{error}</p>
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
    const doneIds = jira?.doneStatusIds ?? null;

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
        const all = doneStatuses.map((status) => status.id);
        const base = doneIds ?? all;
        const next = checked
            ? [...new Set([...base, id])]
            : base.filter((doneId) => doneId !== id);

        void save({
            done_status_ids: next.length === all.length ? null : next,
        });
    };

    const targetSelect = (key: string, label: string) => (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Select
                value={(current[key] as string | null) ?? Automatic}
                disabled={busy}
                onValueChange={(value) =>
                    void save({ [key]: value === Automatic ? null : value })
                }
            >
                <SelectTrigger className="w-full" aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={Automatic}>{t('Automatic')}</SelectItem>
                    {(statuses ?? []).map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                            {status.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

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
                                        checked={
                                            doneIds === null ||
                                            doneIds.includes(status.id)
                                        }
                                        disabled={busy}
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
