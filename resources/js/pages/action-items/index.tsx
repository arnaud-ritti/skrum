import { Head } from '@inertiajs/react';
import { useState } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { NewActionItemButton } from '@/components/action-items/action-item-create-dialog';
import { ActionItemsPage } from '@/components/action-items/action-items-page';
import type { ActionItemsPageProps } from '@/components/action-items/action-items-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function ActionItemsIndex(props: ActionItemsPageProps) {
    const { t } = useTrans();
    const [creating, setCreating] = useState(false);
    const { workspace, filters, filterTeams, creatableTeams } = props;
    const team = filterTeams.find((option) => option.id === filters.team);

    return (
        <AppLayout
            active="actions"
            breadcrumbs={[
                team
                    ? {
                          title: team.name,
                          href: TeamsController.show({
                              workspace: workspace.slug,
                              team: team.id,
                          }),
                      }
                    : {
                          title: workspace.name,
                          href: WorkspacesController.show(workspace.slug),
                      },
                {
                    title: t('Action items'),
                    href: WorkspaceActionItemsController.index(workspace.slug),
                },
            ]}
            actions={
                creatableTeams.length > 0 && (
                    <NewActionItemButton onClick={() => setCreating(true)} />
                )
            }
        >
            <Head title={t('Action items')} />
            <ActionItemsPage
                {...props}
                creating={creating}
                onCreatingChange={setCreating}
            />
        </AppLayout>
    );
}
