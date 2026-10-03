import { Link, router, usePage } from '@inertiajs/react';
import { KeyRound, Palette, Server, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import AdminsController from '@/actions/App/Http/Controllers/Admin/AdminsController';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import SignInSettingsController from '@/actions/App/Http/Controllers/Admin/SignInSettingsController';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';

export type AdminSection =
    | 'general'
    | 'branding'
    | 'signIn'
    | 'mail'
    | 'integrations'
    | 'mcpKeys'
    | 'licence'
    | 'users'
    | 'admins'
    | 'auditLog';

type AdminNavEntry = {
    section: AdminSection;
    label: string;
    icon: LucideIcon;
    href: NavHref;
    /** A state of the section, said beside its name. */
    badge?: string;
};

function subscribeToNothing(): () => void {
    return () => {};
}

/** Host of the instance, empty until the page runs in a browser. */
function useInstanceHost(): string {
    return useSyncExternalStore(
        subscribeToNothing,
        () => window.location.host,
        () => '',
    );
}

function hrefOf(href: NavHref): string {
    return typeof href === 'string' ? href : href.url;
}

export function AdminShell({
    active,
    actions,
    children,
}: {
    active: AdminSection;
    /** Page actions, shown in the topbar after the "Self-host" badge. */
    actions?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTrans();
    const host = useInstanceHost();
    const selectId = useId();
    const { ssoInForce } = usePage().props;
    /** The navigation takes its entries from this list: a new section is one more row. */
    const entries: AdminNavEntry[] = [
        {
            section: 'branding',
            label: t('Branding'),
            icon: Palette,
            href: BrandingController.edit(),
        },
        {
            section: 'signIn',
            label: t('SSO authentication'),
            icon: KeyRound,
            href: SignInSettingsController.edit(),
            badge: ssoInForce === true ? t('active') : undefined,
        },
        {
            section: 'admins',
            label: t('Admins'),
            icon: ShieldCheck,
            href: AdminsController.index(),
        },
    ];
    const current = entries.find((entry) => entry.section === active);

    function visit(section: string): void {
        const entry = entries.find((item) => item.section === section);

        if (entry === undefined || entry.section === active) {
            return;
        }

        router.visit(hrefOf(entry.href));
    }

    return (
        <AppLayout
            active="admin"
            breadcrumbs={[
                { title: t('Administration'), href: entries[0].href },
                ...(current
                    ? [{ title: current.label, href: current.href }]
                    : []),
            ]}
            actions={
                <>
                    <Badge
                        variant="outline"
                        icon={Server}
                        data-slot="admin-self-host"
                        className="hidden shrink-0 md:inline-flex"
                    >
                        {t('Self-host')}
                    </Badge>
                    {actions}
                </>
            }
        >
            <div
                data-slot="admin-shell"
                className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-10"
            >
                <h1 className="sr-only">{t('Administration')}</h1>
                <div className="flex min-w-0 flex-col gap-1.5 lg:hidden">
                    <Label htmlFor={selectId}>{t('Section')}</Label>
                    <Select value={active} onValueChange={visit}>
                        <SelectTrigger id={selectId} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {entries.map((entry) => (
                                <SelectItem
                                    key={entry.section}
                                    value={entry.section}
                                >
                                    {entry.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <aside className="hidden min-w-0 flex-col gap-4 lg:flex lg:w-52 lg:shrink-0">
                    <nav
                        aria-label={t('Administration')}
                        className="flex min-w-0 flex-col gap-1"
                    >
                        <p className="px-3 pb-1 text-overline text-muted-foreground uppercase">
                            {t('Instance')}
                        </p>
                        {entries.map((entry) => (
                            <Link
                                key={entry.section}
                                href={entry.href}
                                aria-current={
                                    entry.section === active
                                        ? 'page'
                                        : undefined
                                }
                                className="flex h-9 min-w-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-skrum-primary-soft aria-[current=page]:text-skrum-primary-text"
                            >
                                <entry.icon
                                    aria-hidden="true"
                                    className="size-4 shrink-0"
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {entry.label}
                                </span>
                                {entry.badge !== undefined && (
                                    <Badge
                                        variant="success"
                                        shape="pill"
                                        data-slot="admin-nav-badge"
                                    >
                                        {entry.badge}
                                    </Badge>
                                )}
                            </Link>
                        ))}
                    </nav>
                    {host !== '' && (
                        <p
                            data-slot="admin-host"
                            title={host}
                            className="truncate rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
                        >
                            {host}
                        </p>
                    )}
                </aside>
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    {children}
                </div>
            </div>
        </AppLayout>
    );
}
