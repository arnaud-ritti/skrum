import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { SignInAlert } from '@/components/admin/sign-in-alert';
import { NotificationsMenu } from '@/components/action-items/notifications-menu';
import { NavUser } from '@/components/nav-user';
import type { NavKey } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame } from '@/components/skrum/frames';
import { CommandMenu } from '@/components/workspaces/command-menu';
import { KeyboardShortcutsDialog } from '@/components/workspaces/keyboard-shortcuts-dialog';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useMinWidth } from '@/hooks/use-min-width';
import { useSidebarModel } from '@/hooks/use-sidebar-model';

const PageSearchFrom = 768;

export default function AppLayout({
    title,
    active,
    status,
    actions,
    search,
    bleed,
    children,
}: {
    /** The page's name, small in the topbar; the page keeps its own heading. */
    title: string;
    active?: NavKey;
    /** A status of the page (a badge), right after the title. */
    status?: ReactNode;
    /** Page actions, at the end of the topbar, before the bell. */
    actions?: ReactNode;
    /**
     * The page's own search, in the topbar's search place from 48rem, where
     * the palette stays on "/"; below, the palette's button and ⌘K as on
     * every page.
     */
    search?: ReactNode;
    /** The page owns its width: a side panel reaches the window's edge. */
    bleed?: boolean;
    children: ReactNode;
}) {
    const sidebar = useSidebarModel(active);
    const { sidebarOpen } = usePage().props;
    const shortcuts = useGlobalShortcuts();
    const pageSearchFits = useMinWidth(PageSearchFrom);

    return (
        <AppFrame
            sidebar={{ ...sidebar, footer: <NavUser /> }}
            defaultOpen={sidebarOpen}
            bleed={bleed}
            topbar={
                <AppTopbar
                    title={title}
                    homeHref={sidebar.homeHref}
                    brand={sidebar.brand}
                    status={status}
                    search={
                        <>
                            {pageSearchFits && search}
                            <CommandMenu
                                links={sidebar.links}
                                wideTrigger={search === undefined}
                                toggleShortcut={
                                    search === undefined || !pageSearchFits
                                }
                            />
                        </>
                    }
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
            <KeyboardShortcutsDialog shortcuts={shortcuts} />
        </AppFrame>
    );
}
