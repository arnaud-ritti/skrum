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
