import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { NavUser } from '@/components/nav-user';
import { SessionFrame } from '@/components/skrum/frames';
import { useSidebarModel } from '@/hooks/use-sidebar-model';

type SessionLayoutProps = {
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
};

function MemberSessionLayout({ children, ...slots }: SessionLayoutProps) {
    const sidebar = useSidebarModel('sessions');

    return (
        <SessionFrame sidebar={{ ...sidebar, footer: <NavUser /> }} {...slots}>
            {children}
        </SessionFrame>
    );
}

export default function SessionLayout({
    children,
    ...slots
}: SessionLayoutProps) {
    const user = usePage().props.auth?.user;

    if (!user) {
        return <SessionFrame {...slots}>{children}</SessionFrame>;
    }

    return <MemberSessionLayout {...slots}>{children}</MemberSessionLayout>;
}
