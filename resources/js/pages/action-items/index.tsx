import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { NewActionItemButton } from '@/components/action-items/action-item-create-dialog';
import { ActionItemSearchField } from '@/components/action-items/action-item-search-field';
import { ActionItemsPage } from '@/components/action-items/action-items-page';
import type { ActionItemsPageProps } from '@/components/action-items/action-items-page';
import { ExportActionItemsButton } from '@/components/action-items/export-action-items-button';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import { requestActionItemsSearch } from '@/lib/action-items/search';

export default function ActionItemsIndex(props: ActionItemsPageProps) {
    const { t } = useTrans();
    const [creating, setCreating] = useState(false);
    const { workspace, filters, creatableTeams } = props;
    const exportButton = (
        <ExportActionItemsButton workspace={workspace.slug} filters={filters} />
    );

    return (
        <AppLayout
            active="actions"
            title={t('Actions')}
            search={
                <ActionItemSearchField
                    value={filters.q ?? null}
                    onSearch={requestActionItemsSearch}
                    className="hidden md:flex"
                />
            }
            actions={
                creatableTeams.length > 0 ? (
                    <NewActionItemButton
                        before={exportButton}
                        onClick={() => setCreating(true)}
                    />
                ) : (
                    exportButton
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
