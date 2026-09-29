import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, Users } from 'lucide-react';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

export function AppSidebar() {
    const { currentWorkspace } = usePage().props;

    const mainNavItems: NavItem[] = [
        {
            title: 'Teams',
            href: currentWorkspace
                ? WorkspacesController.show(currentWorkspace.slug)
                : dashboard(),
            icon: LayoutGrid,
        },
    ];

    if (currentWorkspace && currentWorkspace.role !== 'member') {
        mainNavItems.push({
            title: 'Members',
            href: WorkspaceMembersController.index(currentWorkspace.slug),
            icon: Users,
        });
    }

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <WorkspaceSwitcher />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
