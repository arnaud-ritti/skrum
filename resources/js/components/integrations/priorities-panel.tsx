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
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationScope,
    PriorityLevel,
    ProviderPriority,
    TeamIntegration,
} from '@/types';

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

export function PrioritiesPanel({ scope, connection }: Props) {
    const { t } = useTrans();
    const [priorities, setPriorities] = useState<ProviderPriority[] | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { workspace, team } = scope;
    const integration = connection.id;
    const isJira = connection.provider === 'jira';
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
        } catch (failure) {
            toast.error(
                integrationErrorMessage(failure, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="space-y-3 border-t pt-4">
            <div>
                <h3 className="text-sm font-medium">{t('Priorities')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t('Priority of the issues created from action items.')}
                </p>
            </div>
            {error !== null && (
                <p className="text-sm text-destructive">{error}</p>
            )}
            {priorities === null && error === null && <Spinner />}
            {priorities !== null && (
                <div className="grid gap-2 sm:grid-cols-3">
                    {Levels.map((level) => (
                        <div key={level} className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                                {levelLabels[level]}
                            </p>
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
        </section>
    );
}
