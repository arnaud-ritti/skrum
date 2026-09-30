import { usePage } from '@inertiajs/react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { TeamIntegration } from '@/types';

export type IntegrationDetailRow = {
    label: string;
    value: ReactNode;
};

type Props = {
    rows: IntegrationDetailRow[];
    connection: TeamIntegration;
};

export function IntegrationDetails({ rows, connection }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    const formatDate = (value: string | null): string =>
        value === null
            ? t('Never')
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(new Date(value));

    const allRows: IntegrationDetailRow[] = [
        ...rows,
        {
            label: t('Connected by'),
            value: connection.connectedBy ?? t('Former member'),
        },
        {
            label: t('Last checked'),
            value: formatDate(connection.lastCheckedAt),
        },
    ];

    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {allRows.map((row) => (
                <Fragment key={row.label}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 break-words">{row.value}</dd>
                </Fragment>
            ))}
        </dl>
    );
}
