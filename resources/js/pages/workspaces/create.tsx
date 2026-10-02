import { Head } from '@inertiajs/react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import { CreateWorkspaceForm } from '@/components/workspaces/create-workspace-form';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function CreateWorkspace() {
    const { t } = useTrans();

    return (
        <AppLayout
            active="teams"
            breadcrumbs={[
                {
                    title: t('Create a workspace'),
                    href: WorkspacesController.create(),
                },
            ]}
        >
            <Head title={t('Create a workspace')} />
            <CreateWorkspaceForm />
        </AppLayout>
    );
}
