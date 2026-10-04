import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, PriorityLevel, TeamIntegration } from '@/types';
import { TrackerPanel } from './tracker-parts';

type Props = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

const Levels: PriorityLevel[] = ['high', 'medium', 'low'];

/** Spec 8 §4.2: GitHub priorities are labels the repository already has. */
export function GitHubPriorityLabels({ scope, connection }: Props) {
    const { t } = useTrans();
    const id = useId();
    const saved = connection.settings.priorityLabels ?? {};
    const [labels, setLabels] = useState<Record<PriorityLevel, string>>({
        high: saved.high ?? '',
        medium: saved.medium ?? '',
        low: saved.low ?? '',
    });
    const [errors, setErrors] = useState<
        Partial<Record<PriorityLevel, string>>
    >({});
    const [busy, setBusy] = useState(false);
    const levelLabels: Record<PriorityLevel, string> = {
        high: t('High'),
        medium: t('Medium'),
        low: t('Low'),
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setErrors({});

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    ...scope,
                    integration: connection.id,
                }),
                {
                    priority_labels: Object.fromEntries(
                        Levels.map((level) => [
                            level,
                            labels[level].trim() === ''
                                ? null
                                : labels[level].trim(),
                        ]),
                    ),
                },
            );
            toast.success(t('Priority labels saved.'));
            router.reload({ only: ['providers'] });
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 422) {
                const refused = Object.fromEntries(
                    Levels.map((level) => [
                        level,
                        error.errors[`priority_labels.${level}`]?.[0],
                    ]),
                );
                const first = Levels.find(
                    (level) => refused[level] !== undefined,
                );

                setErrors(refused);

                if (first === undefined) {
                    toast.error(
                        integrationErrorMessage(
                            error,
                            t('Something went wrong.'),
                        ),
                    );
                } else {
                    document.getElementById(`${id}-${first}`)?.focus();
                }
            } else {
                toast.error(
                    integrationErrorMessage(error, t('Something went wrong.')),
                );
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <TrackerPanel
            slot="github-priority-labels"
            title={t('Priority labels')}
            description={t(
                'Label added to exported issues for each priority. Leave empty to add none; skrum never creates labels.',
            )}
        >
            <form
                className="flex min-w-0 flex-col gap-3"
                onSubmit={(event) => void save(event)}
            >
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] items-start gap-3">
                    {Levels.map((level) => (
                        <TextField
                            key={level}
                            id={`${id}-${level}`}
                            label={levelLabels[level]}
                            maxLength={50}
                            autoComplete="off"
                            value={labels[level]}
                            error={errors[level]}
                            onChange={(event) =>
                                setLabels({
                                    ...labels,
                                    [level]: event.target.value,
                                })
                            }
                        />
                    ))}
                </div>
                <LoadingButton
                    type="submit"
                    size="sm"
                    className="max-w-full self-start"
                    loading={busy}
                >
                    <span className="truncate">{t('Save')}</span>
                </LoadingButton>
            </form>
        </TrackerPanel>
    );
}
