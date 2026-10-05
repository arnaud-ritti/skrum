import { Head } from '@inertiajs/react';
import { CreateWorkspaceForm } from '@/components/workspaces/create-workspace-form';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function CreateWorkspace() {
    const { t } = useTrans();

    return (
        <AppLayout active="teams" title={t('Create a workspace')}>
            <Head title={t('Create a workspace')} />
            <CreateWorkspaceForm />
        </AppLayout>
    );
}
