import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';
import type { WorkspaceSummary } from '@/types';

type Props = {
    workspace: WorkspaceSummary;
};

export default function ShowWorkspace({ workspace }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={workspace.name} />
            <div className="space-y-6 p-4">
                <Heading
                    title={workspace.name}
                    description={t('Teams in this workspace')}
                />
            </div>
        </>
    );
}
