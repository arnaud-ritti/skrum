import { Head, router } from '@inertiajs/react';
import { SearchX } from 'lucide-react';
import { useId, useState } from 'react';
import UserDeactivationsController from '@/actions/App/Http/Controllers/Admin/UserDeactivationsController';
import { AdminShell } from '@/components/admin/admin-shell';
import { DeactivateDialog } from '@/components/admin/users/deactivate-dialog';
import { UserFilters, usersUrl } from '@/components/admin/users/user-filters';
import { UsersTable } from '@/components/admin/users/users-table';
import { IconEmpty } from '@/components/skrum/icon-empty';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';
import type { AdminUser, UsersPageProps } from '@/lib/admin/types';

export default function AdminUsers({
    users,
    filters,
    activeAdminCount,
}: UsersPageProps) {
    const { t } = useTrans();
    const titleId = useId();
    const [now] = useState(() => Date.now());
    const [target, setTarget] = useState<AdminUser | null>(null);
    const [deactivating, setDeactivating] = useState(false);

    const askToDeactivate = (user: AdminUser): void => {
        setTarget(user);
        setDeactivating(true);
    };

    const reactivate = (user: AdminUser): void => {
        router.delete(UserDeactivationsController.destroy.url(user.id), {
            preserveScroll: true,
        });
    };

    return (
        <AdminShell active="users">
            <Head title={t('Users')} />
            <section
                aria-labelledby={titleId}
                className="flex max-w-5xl min-w-0 flex-col gap-3"
            >
                <div className="flex min-w-0 flex-col gap-1">
                    <h2
                        id={titleId}
                        className="min-w-0 text-xl font-title tracking-heading"
                    >
                        {t('Users')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Every account of the instance. A deactivated account is signed out and keeps its content.',
                        )}
                    </p>
                </div>
                <UserFilters filters={filters} />
                <Card className="min-w-0">
                    {users.data.length === 0 ? (
                        <IconEmpty icon={SearchX} slot="users-empty">
                            {filters.query?.trim()
                                ? t('No account matches your search.')
                                : t('No account in this state.')}
                        </IconEmpty>
                    ) : (
                        <UsersTable
                            users={users.data}
                            now={now}
                            activeAdminCount={activeAdminCount}
                            onDeactivate={askToDeactivate}
                            onReactivate={reactivate}
                        />
                    )}
                </Card>
                {users.last_page > 1 && (
                    <Pagination
                        page={users.current_page}
                        pageCount={users.last_page}
                        onPageChange={() => undefined}
                        getHref={(page) => usersUrl(filters, page)}
                    />
                )}
            </section>
            <DeactivateDialog
                user={target}
                open={deactivating}
                onOpenChange={setDeactivating}
            />
        </AdminShell>
    );
}
