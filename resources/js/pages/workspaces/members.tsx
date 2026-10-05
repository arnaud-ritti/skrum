import { Head, usePage } from '@inertiajs/react';
import { DeleteWorkspaceSection } from '@/components/workspaces/delete-workspace-section';
import { MembersTable } from '@/components/workspaces/members-table';
import type { WorkspaceMembersProps } from '@/components/workspaces/members-table';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export default function WorkspaceMembers(props: WorkspaceMembersProps) {
    const { t } = useTrans();
    const page = usePage();
    const { auth, locale } = page.props;
    const { workspace, isOwner } = props;

    return (
        <AppLayout active="teams" title={t('Members')}>
            <Head title={t('Members')} />
            <div
                data-slot="workspace-members-page"
                className="flex w-full max-w-4xl min-w-0 flex-col gap-8"
            >
                <header className="flex min-w-0 flex-col gap-1">
                    <h1 className="font-display text-2xl font-bold tracking-heading">
                        {t('Members')}
                    </h1>
                    <p className="text-sm wrap-anywhere text-muted-foreground">
                        {workspace.name}
                    </p>
                </header>
                <MembersTable
                    {...props}
                    currentUserId={auth.user.id}
                    invitationUrl={page.flash.invitationUrl}
                    locale={locale}
                />
                {isOwner && <DeleteWorkspaceSection workspace={workspace} />}
            </div>
        </AppLayout>
    );
}
