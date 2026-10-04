import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { SettingsCard } from '@/components/settings/settings-card';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    ConfirmNameField,
    matchesWorkspaceName,
} from '@/components/workspaces/leave-workspace-dialog';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceSummary } from '@/types';

/** The end of the workspace, for its owners: asked with the typed name. */
export function DeleteWorkspaceSection({
    workspace,
}: {
    workspace: WorkspaceSummary;
}) {
    const { t } = useTrans();
    const fieldId = useId();
    const { run, error, reset } = useRouterAction();
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');

    const changeOpen = (next: boolean): void => {
        setOpen(next);

        if (!next) {
            setTyped('');
            reset();
        }
    };

    return (
        <SettingsCard
            tone="destructive"
            title={t('Delete workspace')}
            description={t(
                'This permanently deletes the workspace and everything in it: its teams and their sessions, boards and action items, the templates and the invitations.',
            )}
        >
            <Button
                type="button"
                variant="destructive"
                size="sm"
                data-test="delete-workspace-button"
                className="max-w-full"
                onClick={() => changeOpen(true)}
            >
                <Trash2 aria-hidden />
                <span className="truncate">{t('Delete workspace')}</span>
            </Button>
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                tone="destructive"
                title={t('Delete this workspace?')}
                description={t(
                    'This permanently deletes the workspace and everything in it: its teams and their sessions, boards and action items, the templates and the invitations.',
                )}
                submitLabel={t('Delete workspace')}
                submitDisabled={!matchesWorkspaceName(typed, workspace.name)}
                submitTest="delete-workspace-confirm"
                onSubmit={() =>
                    run((options) =>
                        router.delete(
                            WorkspacesController.destroy.url(workspace.slug),
                            options,
                        ),
                    )
                }
                error={error}
            >
                <ConfirmNameField
                    id={fieldId}
                    name={workspace.name}
                    value={typed}
                    onChange={setTyped}
                />
            </FormDialog>
        </SettingsCard>
    );
}
