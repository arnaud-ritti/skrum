import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { NavUser } from '@/components/nav-user';
import { NotificationBell } from '@/components/notification-bell';
import type { NavKey } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame } from '@/components/skrum/frames';
import { useSidebarModel } from '@/hooks/use-sidebar-model';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    active,
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    active?: NavKey;
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
                    actions={<NotificationBell />}
                />
            }
        >
            {children}
        </AppFrame>
    );
}
