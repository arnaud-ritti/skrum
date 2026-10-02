import { Head } from '@inertiajs/react';
import { ErrorPage } from '@/components/auth/error-page';
import { useTrans } from '@/hooks/use-trans';

export default function ErrorStatusPage({
    status,
    requestId,
    occurredAt,
    retryAfter,
    returnTo,
}: {
    status: number;
    requestId?: string | null;
    occurredAt?: string | null;
    retryAfter?: number | null;
    returnTo?: string | null;
}) {
    const { t } = useTrans();
    const titles: Record<number, string> = {
        403: t('Access denied'),
        404: t('Page not found'),
        419: t('Page expired'),
        429: t('Too many requests'),
        500: t('Server error'),
    };

    return (
        <>
            <Head title={titles[status] ?? titles[500]} />
            <ErrorPage
                status={status}
                requestId={requestId}
                occurredAt={occurredAt}
                retryAfter={retryAfter}
                returnTo={returnTo}
            />
        </>
    );
}
