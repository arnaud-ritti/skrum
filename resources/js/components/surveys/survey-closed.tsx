import { usePage } from '@inertiajs/react';
import { BarChart3 } from 'lucide-react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { EmptyState } from '@/components/skrum/empty-state';
import { useTrans } from '@/hooks/use-trans';

/** The participant page of a closed survey: no more answers, the results instead. */
export function SurveyClosed({
    closedAt,
    resultsHref,
}: {
    closedAt: string | null;
    resultsHref: NavHref;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const closedOn =
        closedAt === null
            ? null
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
              }).format(new Date(closedAt));

    return (
        <div className="flex h-full items-center justify-center overflow-y-auto p-6">
            <EmptyState
                module="survey"
                title={t('This survey is closed.')}
                description={
                    closedOn === null
                        ? null
                        : t('Closed on :date', { date: closedOn })
                }
                action={{
                    label: t('See the results'),
                    icon: BarChart3,
                    href: resultsHref,
                }}
            />
        </div>
    );
}
