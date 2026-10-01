import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, PriorityLevel, TeamIntegration } from '@/types';

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
                setErrors(
                    Object.fromEntries(
                        Levels.map((level) => [
                            level,
                            error.errors[`priority_labels.${level}`]?.[0],
                        ]),
                    ),
                );
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
        <section className="space-y-3 border-t pt-4">
            <div>
                <h3 className="text-sm font-medium">{t('Priority labels')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Label added to exported issues for each priority. Leave empty to add none; skrum never creates labels.',
                    )}
                </p>
            </div>
            <form className="space-y-2" onSubmit={(event) => void save(event)}>
                {Levels.map((level) => (
                    <div
                        key={level}
                        className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center"
                    >
                        <Label htmlFor={`${id}-${level}`}>
                            {levelLabels[level]}
                        </Label>
                        <div>
                            <Input
                                id={`${id}-${level}`}
                                maxLength={50}
                                value={labels[level]}
                                onChange={(event) =>
                                    setLabels({
                                        ...labels,
                                        [level]: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors[level]} />
                        </div>
                    </div>
                ))}
                <Button type="submit" size="sm" disabled={busy}>
                    {busy && <Spinner />}
                    {t('Save')}
                </Button>
            </form>
        </section>
    );
}
