import { ShieldOff } from 'lucide-react';
import { useId } from 'react';
import type { InstanceAdmin } from '@/components/admin/admins/types';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const columns =
    '@2xl/admins:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_minmax(0,4fr)]';

function AdminRow({
    admin,
    onRevoke,
}: {
    admin: InstanceAdmin;
    onRevoke: (admin: InstanceAdmin) => void;
}) {
    const { t } = useTrans();
    const reasonId = useId();

    return (
        <div
            role="row"
            data-slot="admin-row"
            className={cn(
                'grid min-w-0 grid-cols-1 items-center gap-x-4 gap-y-2 border-b px-5 py-3 last:border-b-0',
                columns,
            )}
        >
            <div role="cell" className="flex min-w-0 items-center gap-3">
                <PersonAvatar
                    decorative
                    name={admin.name}
                    src={admin.avatarUrl}
                    size="md"
                    className="shrink-0"
                />
                <span className="truncate text-sm font-semibold">
                    {admin.name}
                </span>
                {admin.isSelf && <Badge variant="soft">{t('You')}</Badge>}
            </div>
            <div
                role="cell"
                className="min-w-0 truncate text-sm text-muted-foreground"
            >
                {admin.email}
            </div>
            <div
                role="cell"
                className="flex min-w-0 flex-col items-start gap-1 @2xl/admins:items-end"
            >
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-disabled={admin.canRevoke ? undefined : true}
                    aria-label={t('Revoke admin rights of :name', {
                        name: admin.name,
                    })}
                    aria-describedby={admin.canRevoke ? undefined : reasonId}
                    onClick={() => {
                        if (admin.canRevoke) {
                            onRevoke(admin);
                        }
                    }}
                    className="max-w-full text-skrum-destructive-text aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                >
                    <ShieldOff aria-hidden="true" />
                    <span className="truncate">{t('Revoke')}</span>
                </Button>
                {!admin.canRevoke && (
                    <span
                        id={reasonId}
                        data-slot="admin-revoke-reason"
                        className="text-xs text-muted-foreground @2xl/admins:text-right"
                    >
                        {t('An instance needs at least one admin.')}
                    </span>
                )}
            </div>
        </div>
    );
}

export function AdminsList({
    admins,
    onRevoke,
    className,
}: {
    admins: InstanceAdmin[];
    onRevoke: (admin: InstanceAdmin) => void;
    className?: string;
}) {
    const { t } = useTrans();

    if (admins.length === 0) {
        return (
            <p
                data-slot="admins-empty"
                className={cn(
                    'px-5 py-8 text-center text-sm text-muted-foreground',
                    className,
                )}
            >
                {t('No instance admin yet.')}
            </p>
        );
    }

    return (
        <div className={cn('@container/admins min-w-0', className)}>
            <div
                role="table"
                aria-label={t('Instance admins')}
                data-slot="admins-list"
                className="min-w-0"
            >
                <div role="rowgroup">
                    <div
                        role="row"
                        className={cn(
                            'sr-only gap-x-4 border-b text-xs font-semibold text-muted-foreground @2xl/admins:not-sr-only @2xl/admins:grid @2xl/admins:px-5! @2xl/admins:py-2!',
                            columns,
                        )}
                    >
                        <span role="columnheader" className="truncate">
                            {t('Name')}
                        </span>
                        <span role="columnheader" className="truncate">
                            {t('Email address')}
                        </span>
                        <span
                            role="columnheader"
                            className="truncate @2xl/admins:text-right"
                        >
                            {t('Actions')}
                        </span>
                    </div>
                </div>
                <div role="rowgroup">
                    {admins.map((admin) => (
                        <AdminRow
                            key={admin.id}
                            admin={admin}
                            onRevoke={onRevoke}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
