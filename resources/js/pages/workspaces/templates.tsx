import { Head } from '@inertiajs/react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import { TemplatesPage } from '@/components/workspaces/templates-page';
import type { TemplatesPageProps } from '@/components/workspaces/templates-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function WorkspaceTemplates(props: TemplatesPageProps) {
    const { t } = useTrans();
    const { workspace } = props;

    return (
        <AppLayout
            active="templates"
            breadcrumbs={[
                {
                    title: workspace.name,
                    href: WorkspacesController.show(workspace.slug),
                },
                {
                    title: t('Templates'),
                    href: WorkspaceTemplatesController.index(workspace.slug),
                },
            ]}
        >
            <Head title={t('Templates')} />
            <TemplatesPage {...props} />
        </AppLayout>
    );
}
