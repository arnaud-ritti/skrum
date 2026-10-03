import { router } from '@inertiajs/react';
import { useState } from 'react';
import WorkspaceDetailsController from '@/actions/App/Http/Controllers/WorkspaceDetailsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField, TextareaField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceSummary } from '@/types';

/** `WorkspaceDetailsController::update`: the limits of the two fields. */
const NameMaxLength = 100;
const DescriptionMaxLength = 200;

type Details = { name: string; description: string };

type DetailsErrors = Partial<Details> & { other?: string };

/** The name and the description of a workspace, for its managers (decision 7 B). */
export function WorkspaceDetailsDialog({
    open,
    onOpenChange,
    workspace,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspace: WorkspaceSummary;
}) {
    const { t } = useTrans();
    const initial = (): Details => ({
        name: workspace.name,
        description: workspace.description ?? '',
    });
    const [details, setDetails] = useState<Details>(initial);
    const [errors, setErrors] = useState<DetailsErrors>({});

    const changeOpen = (next: boolean): void => {
        if (next) {
            setDetails(initial());
        }

        setErrors({});
        onOpenChange(next);
    };

    const save = (): Promise<void> =>
        new Promise<void>((resolve, reject) => {
            let settled = false;

            const fail = (failures: DetailsErrors): void => {
                if (settled) {
                    return;
                }

                settled = true;
                setErrors(failures);
                reject(new Error('The workspace was not saved.'));
            };

            setErrors({});

            router.put(
                WorkspaceDetailsController.update.url(workspace.slug),
                details,
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        settled = true;
                        resolve();
                        changeOpen(false);
                    },
                    onError: (failures: Record<string, string>) =>
                        fail({
                            name: failures.name,
                            description: failures.description,
                        }),
                    onFinish: () =>
                        fail({
                            other: t('Something went wrong. Please try again.'),
                        }),
                },
            );
        });

    return (
        <FormDialog
            open={open}
            onOpenChange={changeOpen}
            title={t('Workspace')}
            submitLabel={t('Save')}
            onSubmit={save}
            error={errors.other}
        >
            <TextField
                id="workspace-name"
                label={t('Name')}
                name="name"
                required
                autoFocus
                maxLength={NameMaxLength}
                value={details.name}
                onChange={(event) =>
                    setDetails({ ...details, name: event.target.value })
                }
                error={errors.name}
            />
            <TextareaField
                id="workspace-description"
                label={t('Description')}
                name="description"
                rows={3}
                maxLength={DescriptionMaxLength}
                value={details.description}
                onChange={(event) =>
                    setDetails({ ...details, description: event.target.value })
                }
                error={errors.description}
            />
            <p className="text-body-sm text-muted-foreground">
                {t('The workspace address does not change.')}
            </p>
        </FormDialog>
    );
}
