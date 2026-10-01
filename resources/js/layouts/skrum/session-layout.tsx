import type { ReactNode } from 'react';
import { NavUser } from '@/components/nav-user';
import { SessionFrame } from '@/components/skrum/frames';
import { useSidebarModel } from '@/hooks/use-sidebar-model';

export default function SessionLayout({
    title,
    phases,
    timer,
    presence,
    actions,
    children,
}: {
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const sidebar = useSidebarModel('sessions');

    return (
        <SessionFrame
            sidebar={{ ...sidebar, footer: <NavUser /> }}
            title={title}
            phases={phases}
            timer={timer}
            presence={presence}
            actions={actions}
        >
            {children}
        </SessionFrame>
    );
}
