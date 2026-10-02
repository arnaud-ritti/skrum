import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { SignInAlert } from '@/components/admin/sign-in-alert';
import { NotificationsMenu } from '@/components/action-items/notifications-menu';
import { NavUser } from '@/components/nav-user';
import type { NavKey } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame } from '@/components/skrum/frames';
import { CommandMenu } from '@/components/workspaces/command-menu';
import { useSidebarModel } from '@/hooks/use-sidebar-model';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    active,
    actions,
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    active?: NavKey;
    /** Page actions, at the end of the topbar, before the bell. */
    actions?: ReactNode;
    children: ReactNode;
}) {
    const sidebar = useSidebarModel(active);
    const { sidebarOpen } = usePage().props;

    return (
        <AppFrame
            sidebar={{ ...sidebar, footer: <NavUser /> }}
            defaultOpen={sidebarOpen}
            topbar={
                <AppTopbar
                    breadcrumbs={breadcrumbs}
                    search={<CommandMenu links={sidebar.links} />}
                    actions={
                        <>
                            {actions}
                            <NotificationsMenu />
                        </>
                    }
                />
            }
        >
            <SignInAlert />
            {children}
        </AppFrame>
    );
}
