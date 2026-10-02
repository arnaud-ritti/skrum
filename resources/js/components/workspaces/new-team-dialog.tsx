import { router } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';

const TeamNameMaxLength = 100;

export function NewTeamDialog({
    open,
    onOpenChange,
    workspaceSlug,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceSlug: string;
}) {
    const { t } = useTrans();
    const { run, error, reset } = useRouterAction();

    return (
        <FormDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    reset();
                }

                onOpenChange(next);
            }}
            title={t('New team')}
            description={t('Teams share the templates of this workspace.')}
            submitLabel={t('Create team')}
            onSubmit={(data) => {
                const name = data.get('name');

                return run((options) =>
                    router.post(
                        TeamsController.store.url(workspaceSlug),
                        { name: typeof name === 'string' ? name : '' },
                        options,
                    ),
                );
            }}
            error={error}
        >
            <TextField
                label={t('New team name')}
                name="name"
                required
                autoFocus
                maxLength={TeamNameMaxLength}
            />
        </FormDialog>
    );
}
