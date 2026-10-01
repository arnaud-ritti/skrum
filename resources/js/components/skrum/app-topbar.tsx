import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem } from '@/types';

export function AppTopbar({
    breadcrumbs = [],
    search,
    actions,
}: {
    breadcrumbs?: BreadcrumbItem[];
    search?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-10">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <div className="min-w-0 flex-1">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            {search}
            {actions}
        </header>
    );
}
