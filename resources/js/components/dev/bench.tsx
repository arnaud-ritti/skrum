import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AppSidebarProps } from '@/components/skrum/app-sidebar';

export type BenchGroup = 'foundations' | 'layouts' | 'ui' | 'skrum';

export const benchSidebar: AppSidebarProps = {
    active: 'dashboard',
    team: { id: 'atlas', name: 'Atlas', initials: 'AT', membersCount: 8 },
    teams: [
        { id: 'atlas', name: 'Atlas', href: '/dev/design-system/app' },
        { id: 'boreal', name: 'Boréal', href: '/dev/design-system/app' },
    ],
    workspace: { id: 'nordlys', name: 'Nordlys' },
    workspaces: [
        { id: 'nordlys', name: 'Nordlys', href: '/dev/design-system/app' },
    ],
    newWorkspaceHref: '/dev/design-system/app',
    homeHref: '/dev/design-system',
    links: {
        dashboard: '/dev/design-system/app',
        sessions: '/dev/design-system/session',
        actions: '/dev/design-system/app',
        mood: '/dev/design-system/app',
        games: '/dev/design-system/app',
        members: '/dev/design-system/app',
        templates: '/dev/design-system/app',
        teams: '/dev/design-system/app',
        settings: '/dev/design-system/settings',
        admin: '/dev/design-system/settings',
    },
    overdueActions: 2,
};

export function BenchSample({ label }: { label: string }) {
    return (
        <div className="rounded-lg border bg-card p-6 shadow-card">
            <p className="text-sm/snug">{label}</p>
        </div>
    );
}

/**
 * Room for the one real open overlay of a section. An overlay is fixed to the
 * viewport, so its state comes last, fills one viewport and keeps itself in
 * view: the overlay then covers no other state in a full-page capture.
 */
export function BenchOverlayStage({ children }: { children: ReactNode }) {
    const stageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const keepInView = (): void => {
            stageRef.current?.scrollIntoView({ block: 'end' });
        };

        keepInView();
        window.addEventListener('resize', keepInView);

        return () => window.removeEventListener('resize', keepInView);
    }, []);

    return (
        <div
            ref={stageRef}
            data-slot="bench-overlay-stage"
            className="min-h-dvh"
        >
            {children}
        </div>
    );
}
