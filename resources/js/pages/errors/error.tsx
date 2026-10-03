import { Head } from '@inertiajs/react';
import { AccessRequestBlock } from '@/components/auth/access-request-block';
import type { AccessRequestOffer } from '@/components/auth/access-request-block';
import { authLinkClass } from '@/components/auth/auth-link';
import { ErrorPage } from '@/components/auth/error-page';
import { useTrans } from '@/hooks/use-trans';

export default function ErrorStatusPage({
    status,
    requestId,
    occurredAt,
    retryAfter,
    returnTo,
    statusUrl,
    version,
    accessRequest,
}: {
    status: number;
    requestId?: string | null;
    occurredAt?: string | null;
    retryAfter?: number | null;
    returnTo?: string | null;
    statusUrl?: string;
    /** Signed-in viewers only. */
    version?: string;
    /** A 403 about a team of the viewer's workspace. */
    accessRequest?: AccessRequestOffer;
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
                headerLinks={
                    statusUrl ? (
                        <a href={statusUrl} className={authLinkClass}>
                            {t('Instance status')}
                        </a>
                    ) : undefined
                }
                version={version ? `v${version}` : undefined}
                accessRequest={
                    accessRequest ? (
                        <AccessRequestBlock offer={accessRequest} />
                    ) : undefined
                }
            />
        </>
    );
}
