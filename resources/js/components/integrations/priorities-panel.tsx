import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationPrioritiesController from '@/actions/App/Http/Controllers/Integrations/IntegrationPrioritiesController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
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
import type {
    IntegrationScope,
    PriorityLevel,
    ProviderPriority,
    TeamIntegration,
} from '@/types';
import { PanelError, PanelLoading, TrackerPanel } from './tracker-parts';

const Levels: PriorityLevel[] = ['high', 'medium', 'low'];

const DefaultChoice = 'default';

const DontSetChoice = 'none';

/** Jira's own priority names, matched on export (spec §7.2); not translated. */
const JiraDefaultNames: Record<PriorityLevel, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const LinearDefaults: Record<PriorityLevel, number> = {
    high: 2,
    medium: 3,
    low: 4,
};

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

type Failure = { error: unknown };

export function PrioritiesPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [priorities, setPriorities] = useState<ProviderPriority[] | null>(
        null,
    );
    const [failure, setFailure] = useState<Failure | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [busy, setBusy] = useState(false);
    const { workspace, team } = scope;
    const integration = connection.id;
    const isJira =
        connection.provider === 'jira' || connection.provider === 'jira_dc';
    const map = connection.settings.priorityMap ?? {};
    const levelLabels: Record<PriorityLevel, string> = {
        high: t('High'),
        medium: t('Medium'),
        low: t('Low'),
    };

    useEffect(() => {
        let cancelled = false;

        retroRequest<ProviderPriority[]>(
            IntegrationPrioritiesController.index({
                workspace,
                team,
                integration,
            }),
        )
            .then((loaded) => {
                if (!cancelled) {
                    setPriorities(loaded);
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

    const current = (level: PriorityLevel): string => {
        if (!(level in map)) {
            return DefaultChoice;
        }

        const value = map[level];

        if (value === null || value === undefined) {
            return DontSetChoice;
        }

        return typeof value === 'number' ? String(value) : value.id;
    };

    const defaultName = (level: PriorityLevel): string => {
        if (isJira) {
            return JiraDefaultNames[level];
        }

        return (
            priorities?.find(
                (priority) => priority.id === LinearDefaults[level],
            )?.name ?? String(LinearDefaults[level])
        );
    };

    const change = async (level: PriorityLevel, choice: string) => {
        let value: string | number | null = choice;

        if (choice === DontSetChoice) {
            value = null;
        }

        if (!isJira && choice !== DefaultChoice) {
            value = Number(choice);
        }

        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    workspace,
                    team,
                    integration,
                }),
                { priority_map: { [level]: value } },
            );
            toast.success(t('Priority mapping saved.'));
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <TrackerPanel
            slot="tracker-priorities"
            title={t('Priorities')}
            description={t('Priority of the issues created from action items.')}
        >
            {failure !== null && (
                <PanelError
                    message={integrationErrorMessage(
                        failure.error,
                        t('Something went wrong.'),
                    )}
                    retryLabel={t('Retry')}
                    onRetry={retry}
                />
            )}
            {priorities === null && failure === null && (
                <PanelLoading rows={2} />
            )}
            {priorities !== null && (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
                    {Levels.map((level) => (
                        <div
                            key={level}
                            className="flex min-w-0 flex-col gap-1.5"
                        >
                            <span
                                aria-hidden="true"
                                className="text-sm font-medium"
                            >
                                {levelLabels[level]}
                            </span>
                            <Select
                                value={current(level)}
                                disabled={busy}
                                onValueChange={(choice) =>
                                    void change(level, choice)
                                }
                            >
                                <SelectTrigger
                                    className="w-full"
                                    aria-label={t('Priority for :level', {
                                        level: levelLabels[level],
                                    })}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={DefaultChoice}>
                                        {t('Default (:name)', {
                                            name: defaultName(level),
                                        })}
                                    </SelectItem>
                                    {isJira && (
                                        <SelectItem value={DontSetChoice}>
                                            {t("Don't set")}
                                        </SelectItem>
                                    )}
                                    {priorities.map((priority) => (
                                        <SelectItem
                                            key={String(priority.id)}
                                            value={String(priority.id)}
                                        >
                                            {priority.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            )}
        </TrackerPanel>
    );
}
