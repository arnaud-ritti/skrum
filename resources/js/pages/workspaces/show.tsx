import { Head, usePage } from '@inertiajs/react';
import { WorkspaceOverview } from '@/components/workspaces/workspace-overview';
import type { WorkspaceOverviewProps } from '@/components/workspaces/workspace-overview';
import AppLayout from '@/layouts/skrum/app-layout';

export default function ShowWorkspace(props: WorkspaceOverviewProps) {
    const { currentWorkspace } = usePage().props;
    const { workspace } = props;

    return (
        <AppLayout active="teams" title={workspace.name}>
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
