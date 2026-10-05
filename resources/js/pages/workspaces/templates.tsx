import { Head } from '@inertiajs/react';
import { TemplatesPage } from '@/components/workspaces/templates-page';
import type { TemplatesPageProps } from '@/components/workspaces/templates-page';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function WorkspaceTemplates(props: TemplatesPageProps) {
    const { t } = useTrans();

    return (
        <AppLayout active="templates" title={t('Templates')}>
            <Head title={t('Templates')} />
            <TemplatesPage {...props} />
        </AppLayout>
    );
}
