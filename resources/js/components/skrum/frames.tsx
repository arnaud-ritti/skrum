import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
    AppSidebar,
    type AppSidebarProps,
} from '@/components/skrum/app-sidebar';
import { BrandLogo } from '@/components/skrum/brand-logo';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { SubNav, type SubNavItem } from '@/components/skrum/sub-nav';
import {
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar';
import type { BrandIdentity } from '@/types';

function Inset({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'relative flex min-h-svh max-w-full flex-1 flex-col bg-background',
                className,
            )}
        >
            {children}
        </div>
    );
}

function TabBar({ sidebar }: { sidebar: AppSidebarProps }) {
    const { toggleSidebar, openMobile } = useSidebar();

    return (
        <MobileTabBar
            active={sidebar.active}
            links={sidebar.links}
            onMore={toggleSidebar}
            moreOpen={openMobile}
        />
    );
}

export function AppFrame({
    sidebar,
    defaultOpen = true,
    topbar,
    children,
}: {
    sidebar: AppSidebarProps;
    defaultOpen?: boolean;
    topbar: ReactNode;
    children: ReactNode;
}) {
    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar {...sidebar} />
            <Inset className="min-w-0 overflow-x-clip pb-14 md:pb-0">
                {topbar}
                <main className="mx-auto w-full max-w-page flex-1 px-4 py-6 md:px-10">
                    {children}
                </main>
            </Inset>
            <TabBar sidebar={sidebar} />
        </SidebarProvider>
    );
}

export function SessionFrame({
    sidebar,
    logo,
    title,
    phases,
    status,
    timer,
    presence,
    actions,
    avatar,
    children,
}: {
    /** Absent for a guest: no application sidebar and no trigger. */
    sidebar?: AppSidebarProps;
    /** Start of the header on a screen without the application rail (whiteboard). */
    logo?: ReactNode;
    title: ReactNode;
    phases?: ReactNode;
    /** Connection state, before the timer and the people present. */
    status?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    /** The viewer, at the end of the header. */
    avatar?: ReactNode;
    children: ReactNode;
}) {
    const inset = (
        <Inset className="h-svh min-w-0 overflow-hidden bg-skrum-canvas">
            <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
                {sidebar && <SidebarTrigger className="-ml-1 md:hidden" />}
                {logo}
                <div className="min-w-0 truncate text-base font-semibold">
                    {title}
                </div>
                <div className="flex min-w-0 flex-1 justify-center *:min-w-0 *:flex-1">
                    {phases}
                </div>
                {status}
                {timer}
                {presence}
                {actions}
                {avatar}
            </header>
            <main className="relative min-h-0 flex-1">{children}</main>
        </Inset>
    );

    if (!sidebar) {
        return (
            <div data-slot="session-frame" className="flex min-h-svh w-full">
                {inset}
            </div>
        );
    }

    return (
        <SidebarProvider defaultOpen={false}>
            <AppSidebar {...sidebar} />
            {inset}
        </SidebarProvider>
    );
}

export function SettingsFrame({
    title,
    description,
    nav,
    navLabel,
    children,
}: {
    title: string;
    description?: string;
    nav: SubNavItem[];
    navLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-title tracking-heading">
                    {title}
                </h1>
                {description && (
                    <p className="text-sm/snug text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-10">
                <SubNav items={nav} label={navLabel} />
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

const dotPattern = {
    backgroundImage:
        'radial-gradient(var(--skrum-canvas-dot) 1.2px, transparent 1.3px)',
    backgroundSize: '1.25rem 1.25rem',
};

export function AuthFrame({
    brand,
    title,
    description,
    aside,
    headerEnd,
    footer,
    variant = 'split',
    children,
}: {
    brand?: BrandIdentity;
    title: string;
    description?: string;
    aside?: ReactNode;
    headerEnd?: ReactNode;
    footer?: ReactNode;
    /** `centered`: one column, the title only for screen readers, no aside. */
    variant?: 'split' | 'centered';
    children: ReactNode;
}) {
    if (variant === 'centered') {
        return (
            <div className="flex min-h-svh min-w-0 flex-col gap-8 p-6 md:p-10">
                <header className="flex items-center justify-between gap-4">
                    <BrandLogo
                        brand={brand}
                        className="h-12"
                        fallback={<SkrumLogo className="h-7 w-auto" />}
                    />
                    {headerEnd}
                </header>
                <main className="mx-auto flex w-full max-w-120 flex-1 flex-col justify-center gap-6">
                    <h1 className="sr-only">{title}</h1>
                    {children}
                </main>
                {footer && (
                    <footer className="text-center text-xs text-muted-foreground">
                        {footer}
                    </footer>
                )}
            </div>
        );
    }

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-8 p-6 md:p-10">
                <header className="flex items-center justify-between gap-4">
                    <BrandLogo
                        brand={brand}
                        className="h-12"
                        fallback={<SkrumLogo className="h-7 w-auto" />}
                    />
                    {headerEnd}
                </header>
                <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-title tracking-heading">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-sm/snug text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {children}
                </main>
                {footer && (
                    <footer className="text-center text-xs text-muted-foreground">
                        {footer}
                    </footer>
                )}
            </div>
            <aside
                className="hidden items-center justify-center bg-secondary p-10 lg:flex"
                style={dotPattern}
            >
                {aside ?? <SkrumLogo variant="symbol" className="size-24" />}
            </aside>
        </div>
    );
}

export function OnboardingFrame({
    brand,
    stepper,
    headerEnd,
    aside,
    children,
}: {
    brand?: BrandIdentity;
    stepper?: ReactNode;
    headerEnd?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-svh flex-col">
            <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4 md:px-10">
                <BrandLogo
                    brand={brand}
                    className="h-7"
                    fallback={<SkrumLogo className="h-6 w-auto" />}
                />
                <div className="flex min-w-0 flex-1 justify-center *:min-w-0 *:flex-1">
                    {stepper}
                </div>
                {headerEnd}
            </header>
            <div className="mx-auto grid w-full max-w-page flex-1 gap-10 px-4 py-10 md:px-10 lg:grid-cols-2">
                <main className="min-w-0">{children}</main>
                {aside && (
                    <aside className="hidden min-w-0 lg:block">{aside}</aside>
                )}
            </div>
        </div>
    );
}
