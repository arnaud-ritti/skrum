import { Link, router, usePage } from '@inertiajs/react';
import {
    BadgeCheck,
    Bot,
    KeyRound,
    Mail,
    Palette,
    Plug,
    ScrollText,
    Server,
    ShieldCheck,
    TriangleAlert,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import AdminsController from '@/actions/App/Http/Controllers/Admin/AdminsController';
import AuditEventsController from '@/actions/App/Http/Controllers/Admin/AuditEventsController';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import GeneralSettingsController from '@/actions/App/Http/Controllers/Admin/GeneralSettingsController';
import IntegrationSettingsController from '@/actions/App/Http/Controllers/Admin/IntegrationSettingsController';
import LicencesController from '@/actions/App/Http/Controllers/Admin/LicencesController';
import MailSettingsController from '@/actions/App/Http/Controllers/Admin/MailSettingsController';
import McpKeysController from '@/actions/App/Http/Controllers/Admin/McpKeysController';
import SignInSettingsController from '@/actions/App/Http/Controllers/Admin/SignInSettingsController';
import UsersController from '@/actions/App/Http/Controllers/Admin/UsersController';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type { AdminSection, InstanceVersionStatus } from '@/lib/admin/types';

type AdminNavEntry = {
    section: AdminSection;
    label: string;
    icon: LucideIcon;
    href: NavHref;
    /** A state of the section, said beside its name. */
    badge?: string;
    /** The badge as a screen reader says it, when its text alone is terse. */
    badgeLabel?: string;
    badgeVariant?: 'success' | 'muted';
};

type AdminNavGroup = {
    key: 'instance' | 'supervision';
    label: string;
    entries: AdminNavEntry[];
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

/** The version of the instance and, for an admin, whether it is up to date. */
function InstanceVersionLine({
    version,
    status,
}: {
    version: string;
    status: InstanceVersionStatus | null;
}) {
    const { t } = useTrans();

    return (
        <span data-slot="admin-version" className="block font-mono">
            v{version}
            {status?.state === 'current' && (
                <span
                    data-slot="admin-version-state"
                    className="text-skrum-success-text"
                >
                    {` · ${t('up to date')}`}
                </span>
            )}
            {status?.state === 'outdated' && status.latest !== null && (
                <span
                    data-slot="admin-version-state"
                    className="text-skrum-warning-text"
                >
                    {` · ${t('update available: v:version', { version: status.latest })}`}
                    <TriangleAlert
                        aria-hidden="true"
                        className="ml-1 inline-block size-3 align-middle"
                    />
                </span>
            )}
        </span>
    );
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
    const groupId = useId();
    const {
        ssoInForce,
        integrationCounts,
        instanceVersion,
        instanceVersionStatus,
    } = usePage().props;
    const countsIntegrations =
        integrationCounts !== null &&
        integrationCounts !== undefined &&
        integrationCounts.configured > 0;
    /** The navigation takes its entries from these groups: a new section is one more row. */
    const groups: AdminNavGroup[] = [
        {
            key: 'instance',
            label: t('Instance'),
            entries: [
                {
                    section: 'general',
                    label: t('General'),
                    icon: Server,
                    href: GeneralSettingsController.edit(),
                },
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
                    section: 'mail',
                    label: t('SMTP'),
                    icon: Mail,
                    href: MailSettingsController.show(),
                },
                {
                    section: 'integrations',
                    label: t('Integrations'),
                    icon: Plug,
                    href: IntegrationSettingsController.edit(),
                    badge: countsIntegrations
                        ? `${integrationCounts.enabled}/${integrationCounts.configured}`
                        : undefined,
                    badgeLabel: countsIntegrations
                        ? t(
                              ':enabled of :configured configured integrations turned on',
                              {
                                  enabled: integrationCounts.enabled,
                                  configured: integrationCounts.configured,
                              },
                          )
                        : undefined,
                    badgeVariant: 'muted',
                },
                {
                    section: 'mcpKeys',
                    label: t('MCP keys'),
                    icon: Bot,
                    href: McpKeysController.index(),
                },
                {
                    section: 'licence',
                    label: t('Licence'),
                    icon: BadgeCheck,
                    href: LicencesController.show(),
                },
            ],
        },
        {
            key: 'supervision',
            label: t('Supervision'),
            entries: [
                {
                    section: 'users',
                    label: t('Users'),
                    icon: Users,
                    href: UsersController.index(),
                },
                {
                    section: 'admins',
                    label: t('Admins'),
                    icon: ShieldCheck,
                    href: AdminsController.index(),
                },
                {
                    section: 'auditLog',
                    label: t('Audit log'),
                    icon: ScrollText,
                    href: AuditEventsController.index(),
                },
            ],
        },
    ];
    const entries = groups.flatMap((group) => group.entries);
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
                            {groups.map((group) => (
                                <SelectGroup key={group.key}>
                                    <SelectLabel>{group.label}</SelectLabel>
                                    {group.entries.map((entry) => (
                                        <SelectItem
                                            key={entry.section}
                                            value={entry.section}
                                        >
                                            {entry.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <aside className="hidden min-w-0 flex-col gap-4 lg:flex lg:w-52 lg:shrink-0">
                    <nav
                        aria-label={t('Administration')}
                        className="flex min-w-0 flex-col gap-4"
                    >
                        {groups.map((group) => (
                            <div
                                key={group.key}
                                role="group"
                                aria-labelledby={`${groupId}-${group.key}`}
                                className="flex min-w-0 flex-col gap-1"
                            >
                                <p
                                    id={`${groupId}-${group.key}`}
                                    className="px-3 pb-1 text-overline text-muted-foreground uppercase"
                                >
                                    {group.label}
                                </p>
                                {group.entries.map((entry) => (
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
                                                variant={
                                                    entry.badgeVariant ??
                                                    'success'
                                                }
                                                shape="pill"
                                                data-slot="admin-nav-badge"
                                                aria-hidden={
                                                    entry.badgeLabel !==
                                                    undefined
                                                        ? true
                                                        : undefined
                                                }
                                            >
                                                {entry.badge}
                                            </Badge>
                                        )}
                                        {entry.badgeLabel !== undefined && (
                                            <span className="sr-only">
                                                {entry.badgeLabel}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </nav>
                    {(host !== '' || typeof instanceVersion === 'string') && (
                        <div
                            data-slot="admin-instance"
                            className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
                        >
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                {host !== '' && (
                                    <span
                                        data-slot="admin-host"
                                        title={host}
                                        className="truncate"
                                    >
                                        {host}
                                    </span>
                                )}
                                {typeof instanceVersion === 'string' && (
                                    <InstanceVersionLine
                                        version={instanceVersion}
                                        status={instanceVersionStatus}
                                    />
                                )}
                            </span>
                            {instanceVersionStatus?.state === 'current' && (
                                <span
                                    aria-hidden="true"
                                    data-slot="admin-version-dot"
                                    className="size-2 shrink-0 rounded-full bg-skrum-success"
                                />
                            )}
                        </div>
                    )}
                </aside>
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    {children}
                </div>
            </div>
        </AppLayout>
    );
}
