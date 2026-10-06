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
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
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
            newSessionHref={sidebar.newSessionHref}
            liveSessions={sidebar.liveSessions}
            onMore={toggleSidebar}
            moreOpen={openMobile}
        />
    );
}

export function AppFrame({
    sidebar,
    defaultOpen = true,
    topbar,
    bleed = false,
    children,
}: {
    sidebar: AppSidebarProps;
    defaultOpen?: boolean;
    topbar: ReactNode;
    /** The page owns its width: a side panel reaches the window's edge. */
    bleed?: boolean;
    children: ReactNode;
}) {
    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar {...sidebar} />
            <Inset className="min-w-0 overflow-x-clip pb-14 md:pb-0">
                {topbar}
                <main
                    className={cn(
                        'w-full flex-1 px-4 py-6 md:px-10',
                        !bleed && 'mx-auto max-w-page',
                    )}
                >
                    {children}
                </main>
            </Inset>
            <TabBar sidebar={sidebar} />
        </SidebarProvider>
    );
}

/**
 * A session takes the whole screen: no application sidebar, for a member as
 * for a guest. Its header has three parts: the title, the phases, the
 * controls. The two sides share what the phases leave, so the phases sit at
 * the middle of the bar; a side wider than its half keeps its width and the
 * phases move just enough to clear it. Short of room, the title shortens to
 * its floor, then the phases; the controls keep their whole width.
 */
export function SessionFrame({
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
    /** Start of the header on a screen that opens with the logo (whiteboard). */
    logo?: ReactNode;
    title: ReactNode;
    /** The middle of the header: the phases, with their state and their moves. */
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
            {/* The sides carry the bar's padding: a container is measured inside its own, and the steps are widths of the bar. */}
            <header className="@container/session z-30 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-background md:gap-3">
                <div
                    data-slot="session-bar-start"
                    className="flex min-w-32 items-center gap-2 pl-4 md:gap-3"
                >
                    {logo}
                    <div className="min-w-0 truncate text-base font-semibold">
                        {title}
                    </div>
                </div>
                <div
                    data-slot="session-bar-phases"
                    className="flex min-w-0 justify-center *:min-w-0"
                >
                    {phases}
                </div>
                <div
                    data-slot="session-bar-end"
                    className="flex min-w-max items-center justify-end gap-2 pr-4 md:gap-3"
                >
                    {status}
                    {timer}
                    {presence}
                    {actions}
                    {avatar}
                </div>
            </header>
            <main className="relative min-h-0 flex-1">{children}</main>
        </Inset>
    );

    return (
        <div data-slot="session-frame" className="flex min-h-svh w-full">
            {inset}
        </div>
    );
}

export function SettingsFrame({
    title,
    description,
    nav,
    navLabel,
    stuckNav = false,
    children,
}: {
    title: string;
    description?: string;
    nav: SubNavItem[];
    navLabel: string;
    /** Below `lg` the sub-navigation stays under the top bar while the page scrolls. */
    stuckNav?: boolean;
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
                <SubNav items={nav} label={navLabel} stuck={stuckNav} />
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
    phoneIntro,
    children,
}: {
    brand?: BrandIdentity;
    title: string;
    description?: string;
    /**
     * Split variant: on a phone, a centred large mark over the title and this
     * line in place of the description and of the header logo (MobileAccess).
     */
    phoneIntro?: string;
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

    const hasPhoneIntro = phoneIntro !== undefined;
    const headerLogo = (
        <BrandLogo
            brand={brand}
            className="h-12"
            fallback={<SkrumLogo className="h-7 w-auto" />}
        />
    );

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-8 p-6 md:p-10">
                <header className="flex items-center justify-between gap-4">
                    {hasPhoneIntro ? (
                        <span
                            data-slot="auth-header-logo"
                            className="flex max-md:hidden"
                        >
                            {headerLogo}
                        </span>
                    ) : (
                        headerLogo
                    )}
                    {hasPhoneIntro ? (
                        <span className="ml-auto">{headerEnd}</span>
                    ) : (
                        headerEnd
                    )}
                </header>
                <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
                    <div
                        className={cn(
                            'flex flex-col gap-2',
                            hasPhoneIntro &&
                                'max-md:items-center max-md:gap-3 max-md:text-center',
                        )}
                    >
                        {hasPhoneIntro && (
                            <span
                                aria-hidden="true"
                                data-slot="auth-phone-mark"
                                className="flex md:hidden"
                            >
                                <BrandLogo
                                    brand={brand}
                                    className="h-14"
                                    fallback={
                                        <SkrumLogo
                                            variant="symbol"
                                            className="size-14"
                                        />
                                    }
                                />
                            </span>
                        )}
                        <h1 className="text-2xl font-title tracking-heading">
                            {title}
                        </h1>
                        {description && (
                            <p
                                className={cn(
                                    'text-sm/snug text-muted-foreground',
                                    hasPhoneIntro && 'max-md:hidden',
                                )}
                            >
                                {description}
                            </p>
                        )}
                        {hasPhoneIntro && (
                            <p className="text-sm/snug text-muted-foreground md:hidden">
                                {phoneIntro}
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

/**
 * The onboarding's frame (ScreenOnboarding): a header with the stepper in
 * the middle, an optional thin progress bar under it, then the form column
 * and, from `lg`, the dot-grid preview panel beside it.
 */
export function OnboardingFrame({
    brand,
    stepper,
    headerEnd,
    progress,
    aside,
    children,
}: {
    brand?: BrandIdentity;
    stepper?: ReactNode;
    headerEnd?: ReactNode;
    progress?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-svh flex-col bg-background">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 md:gap-4 md:px-10">
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
            {progress}
            <div
                className={cn(
                    'grid min-w-0 flex-1',
                    aside !== undefined && 'lg:grid-cols-2',
                )}
            >
                <main className="flex min-w-0 flex-col">{children}</main>
                {aside !== undefined && (
                    <aside className="bg-dotgrid hidden min-w-0 items-center justify-center border-l p-12 lg:flex">
                        {aside}
                    </aside>
                )}
            </div>
        </div>
    );
}
