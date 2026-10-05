import { useForm } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ReactElement } from 'react';
import DefaultWorkspacesController from '@/actions/App/Http/Controllers/Admin/DefaultWorkspacesController';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';

/** The option "None": a select item cannot have an empty value. */
const NoWorkspace = 'none';

export type DefaultWorkspaceCardProps = {
    defaultWorkspaceId: string | null;
    /** Every workspace of the instance, in the order to show. */
    workspaces: { id: string; name: string }[];
};

type DefaultWorkspaceForm = {
    default_workspace_id: string | null;
};

/** The workspace that new SSO accounts without an invitation join. */
export function DefaultWorkspaceCard({
    defaultWorkspaceId,
    workspaces,
}: DefaultWorkspaceCardProps): ReactElement {
    const { t } = useTrans();
    const selectId = useId();
    const errorId = useId();
    const form = useForm<DefaultWorkspaceForm>({
        default_workspace_id: defaultWorkspaceId,
    });
    const error = form.errors.default_workspace_id;
    const unchanged = form.data.default_workspace_id === defaultWorkspaceId;

    return (
        <form
            data-slot="default-workspace-card"
            className="min-w-0"
            onSubmit={(event) => {
                event.preventDefault();
                form.submit(DefaultWorkspacesController.update(), {
                    preserveScroll: true,
                });
            }}
        >
            <SettingsCard
                title={t('New SSO accounts')}
                description={t(
                    'Accounts created through SSO without an invitation join this workspace as members and start by creating their team.',
                )}
                footer={
                    <LoadingButton
                        type="submit"
                        size="sm"
                        loading={form.processing}
                        disabled={unchanged}
                        className="max-w-full"
                    >
                        <span className="truncate">{t('Save')}</span>
                    </LoadingButton>
                }
            >
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={selectId}>{t('Default workspace')}</Label>
                    <Select
                        value={form.data.default_workspace_id ?? NoWorkspace}
                        onValueChange={(value) => {
                            form.setData(
                                'default_workspace_id',
                                value === NoWorkspace ? null : value,
                            );
                            form.clearErrors('default_workspace_id');
                        }}
                    >
                        <SelectTrigger
                            id={selectId}
                            className="w-full sm:max-w-sm"
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NoWorkspace}>
                                {t('None')}
                            </SelectItem>
                            {workspaces.map((workspace) => (
                                <SelectItem
                                    key={workspace.id}
                                    value={workspace.id}
                                >
                                    {workspace.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {error && (
                        <p
                            id={errorId}
                            data-slot="field-error"
                            className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                        >
                            <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0"
                            />
                            <span className="min-w-0">{error}</span>
                        </p>
                    )}
                </div>
            </SettingsCard>
        </form>
    );
}
