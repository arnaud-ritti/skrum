import { Head, usePage } from '@inertiajs/react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { WorkspaceOverview } from '@/components/workspaces/workspace-overview';
import type { WorkspaceOverviewProps } from '@/components/workspaces/workspace-overview';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function ShowWorkspace(props: WorkspaceOverviewProps) {
    const { t } = useTrans();
    const { currentWorkspace } = usePage().props;
    const { workspace } = props;
    const href = WorkspacesController.show(workspace.slug);

    return (
        <AppLayout
            active="teams"
            breadcrumbs={[
                { title: workspace.name, href },
                { title: t('Workspace'), href },
            ]}
        >
            <Head title={workspace.name} />
            <WorkspaceOverview
                {...props}
                role={
                    currentWorkspace?.id === workspace.id
                        ? currentWorkspace.role
                        : undefined
                }
            />
        </AppLayout>
    );
}
