import { router, usePage } from '@inertiajs/react';
import { Ellipsis, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import type { ReactElement } from 'react';
import AdminsController from '@/actions/App/Http/Controllers/Admin/AdminsController';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardMenu } from '@/components/ui/dropdown-menu';
import type { MenuEntry } from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime, formatShortDate } from '@/lib/action-items/format';
import type { AdminUser } from '@/lib/admin/types';

export type UsersTableProps = {
    users: AdminUser[];
    /** The moment "last sign-in" is counted from. */
    now: number;
    activeAdminCount: number;
    onDeactivate: (user: AdminUser) => void;
    onReactivate: (user: AdminUser) => void;
};

const head = 'px-2 whitespace-normal';
const cell = 'px-2 text-body-sm';
const date = `${cell} tabular-nums`;

/** The last active admin: the instance keeps one (the server refuses it too). */
function isLastActiveAdmin(user: AdminUser, activeAdminCount: number): boolean {
    return user.isAdmin && !user.isDeactivated && activeAdminCount <= 1;
}

function Identity({ user }: { user: AdminUser }): ReactElement {
    return (
        <span className="flex min-w-0 items-center gap-3">
            <PersonAvatar
                decorative
                name={user.name}
                src={user.avatarUrl}
                size="md"
                className="shrink-0"
            />
            <span className="min-w-0">
                <span className="block text-sm font-semibold wrap-anywhere">
                    {user.name}
                </span>
                <span className="block text-xs wrap-anywhere text-muted-foreground">
                    {user.email}
                </span>
            </span>
        </span>
    );
}

function Badges({ user }: { user: AdminUser }): ReactElement | null {
    const { t } = useTrans();

    if (!user.isAdmin && !user.isDeactivated && !user.hasSecondFactor) {
        return null;
    }

    return (
        <span data-slot="user-badges" className="flex flex-wrap gap-1">
            {user.isAdmin && <Badge variant="soft">{t('Admin')}</Badge>}
            {user.isDeactivated && (
                <Badge variant="destructive">{t('Deactivated')}</Badge>
            )}
            {user.hasSecondFactor && (
                <Badge variant="success">{t('2FA on')}</Badge>
            )}
        </span>
    );
}

function RowMenu({
    user,
    activeAdminCount,
    onDeactivate,
    onReactivate,
}: {
    user: AdminUser;
    activeAdminCount: number;
    onDeactivate: (user: AdminUser) => void;
    onReactivate: (user: AdminUser) => void;
}): ReactElement {
    const { t } = useTrans();
    const refusal = user.isSelf
        ? t("You can't deactivate yourself")
        : isLastActiveAdmin(user, activeAdminCount)
          ? t('The instance needs an active admin')
          : undefined;
    const entries: MenuEntry[] = [
        user.isDeactivated
            ? {
                  type: 'item',
                  label: t('Reactivate'),
                  icon: UserCheck,
                  onSelect: () => onReactivate(user),
              }
            : {
                  type: 'item',
                  label: t('Deactivate'),
                  icon: UserX,
                  tone: 'danger',
                  disabled: refusal !== undefined,
                  disabledReason: refusal,
                  onSelect: () => onDeactivate(user),
              },
    ];

    if (!user.isAdmin && !user.isDeactivated) {
        entries.push({
            type: 'item',
            label: t('Make admin'),
            icon: ShieldCheck,
            onSelect: () => router.visit(AdminsController.index.url()),
        });
    }

    return (
        <CardMenu
            label={t('Actions for :name', { name: user.name })}
            entries={entries}
            trigger={
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    data-slot="user-menu"
                    aria-label={t('Actions for :name', { name: user.name })}
                >
                    <Ellipsis aria-hidden />
                </Button>
            }
        />
    );
}

function useUserFormat(now: number) {
    const { locale } = usePage<{ locale: string }>().props;

    return {
        created: (user: AdminUser): string =>
            user.createdAt === null
                ? '—'
                : formatShortDate(user.createdAt, locale),
        lastSignIn: (user: AdminUser): string =>
            user.lastSignedInAt === null
                ? '—'
                : formatRelativeTime(user.lastSignedInAt, locale, now),
    };
}

/**
 * Every account of the instance. Both layouts are in the page: the table from
 * a wide container, stacked cards below it (the mockup's mobile rule).
 */
export function UsersTable({
    users,
    now,
    activeAdminCount,
    onDeactivate,
    onReactivate,
}: UsersTableProps): ReactElement {
    const { t } = useTrans();
    const format = useUserFormat(now);
    const menu = (user: AdminUser): ReactElement => (
        <RowMenu
            user={user}
            activeAdminCount={activeAdminCount}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
        />
    );

    return (
        <div className="@container/users min-w-0">
            <div data-slot="users-table" className="hidden @3xl/users:block">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={`${head} pl-5`}>
                                {t('Account')}
                            </TableHead>
                            <TableHead className={head}>
                                <span className="sr-only">{t('Status')}</span>
                            </TableHead>
                            <TableHead className={`${head} text-right`}>
                                {t('Workspaces')}
                            </TableHead>
                            <TableHead className={head}>
                                {t('Created')}
                            </TableHead>
                            <TableHead className={head}>
                                {t('Last sign-in')}
                            </TableHead>
                            <TableHead className={`${head} pr-5`}>
                                <span className="sr-only">{t('Actions')}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow
                                key={user.id}
                                data-slot="user-row"
                                className="hover:bg-transparent"
                            >
                                <TableCell className={`${cell} pl-5`}>
                                    <Identity user={user} />
                                </TableCell>
                                <TableCell className={cell}>
                                    <Badges user={user} />
                                </TableCell>
                                <TableCell className={`${date} text-right`}>
                                    {user.workspacesCount}
                                </TableCell>
                                <TableCell className={date}>
                                    {format.created(user)}
                                </TableCell>
                                <TableCell
                                    className={
                                        user.lastSignedInAt === null
                                            ? `${date} text-muted-foreground`
                                            : date
                                    }
                                >
                                    {format.lastSignIn(user)}
                                </TableCell>
                                <TableCell
                                    className={`${cell} pr-5 text-right`}
                                >
                                    {menu(user)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ul
                data-slot="users-cards"
                aria-label={t('Users')}
                className="flex flex-col @3xl/users:hidden"
            >
                {users.map((user) => (
                    <li
                        key={user.id}
                        className="flex min-w-0 flex-col gap-3 border-b px-5 py-4 last:border-b-0"
                    >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                            <Identity user={user} />
                            {menu(user)}
                        </div>
                        <Badges user={user} />
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm">
                            <dt className="text-muted-foreground">
                                {t('Workspaces')}
                            </dt>
                            <dd className="min-w-0 tabular-nums">
                                {user.workspacesCount}
                            </dd>
                            <dt className="text-muted-foreground">
                                {t('Created')}
                            </dt>
                            <dd className="min-w-0 tabular-nums">
                                {format.created(user)}
                            </dd>
                            <dt className="text-muted-foreground">
                                {t('Last sign-in')}
                            </dt>
                            <dd className="min-w-0 tabular-nums">
                                {format.lastSignIn(user)}
                            </dd>
                        </dl>
                    </li>
                ))}
            </ul>
        </div>
    );
}
