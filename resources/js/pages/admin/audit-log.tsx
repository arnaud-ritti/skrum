import { Head } from '@inertiajs/react';
import { ScrollText } from 'lucide-react';
import { useId, useState } from 'react';
import {
    AuditFilters,
    auditEventsUrl,
} from '@/components/admin/audit-log/audit-filters';
import { AuditTable } from '@/components/admin/audit-log/audit-table';
import { AdminShell } from '@/components/admin/admin-shell';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';
import type { AuditLogPageProps } from '@/lib/admin/types';

export default function AdminAuditLog({
    events,
    filters,
    retentionDays,
}: AuditLogPageProps) {
    const { t } = useTrans();
    const titleId = useId();
    const [now] = useState(() => Date.now());
    const filtered = filters.group !== null || filters.actor !== null;

    return (
        <AdminShell active="auditLog">
            <Head title={t('Audit log')} />
            <section
                aria-labelledby={titleId}
                className="flex max-w-5xl min-w-0 flex-col gap-3"
            >
                <div className="flex min-w-0 flex-col gap-1">
                    <h2
                        id={titleId}
                        className="min-w-0 text-xl font-title tracking-heading"
                    >
                        {t('Audit log')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Admin actions and security events of the instance, newest first.',
                        )}{' '}
                        <span data-slot="audit-retention">
                            {t('Events are kept :days days.', {
                                days: retentionDays,
                            })}
                        </span>
                    </p>
                </div>
                <AuditFilters filters={filters} events={events.data} />
                <Card className="min-w-0">
                    {events.data.length === 0 ? (
                        <div
                            data-slot="audit-empty"
                            className="flex flex-col items-center gap-3 px-5 py-8 text-center"
                        >
                            <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                                <ScrollText
                                    aria-hidden="true"
                                    className="size-5"
                                />
                            </span>
                            <p className="text-sm text-muted-foreground">
                                {filtered
                                    ? t('No event matches these filters.')
                                    : t('No event recorded yet.')}
                            </p>
                        </div>
                    ) : (
                        <AuditTable events={events.data} now={now} />
                    )}
                </Card>
                {events.last_page > 1 && (
                    <Pagination
                        page={events.current_page}
                        pageCount={events.last_page}
                        onPageChange={() => undefined}
                        getHref={(page) => auditEventsUrl(filters, page)}
                    />
                )}
            </section>
        </AdminShell>
    );
}
