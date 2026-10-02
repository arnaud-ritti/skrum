import { EmptyState } from '@/components/skrum/empty-state';
import { SessionTitle } from '@/components/session/session-title';
import { useTrans } from '@/hooks/use-trans';
import SessionLayout from '@/layouts/skrum/session-layout';

/** The board is no longer there for this viewer. No realtime root: nothing is live. */
export function BoardGone({
    title,
    reason,
    teamUrl,
}: {
    title: string;
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
}) {
    const { t } = useTrans();

    return (
        <SessionLayout title={<SessionTitle>{title}</SessionTitle>}>
            <div className="flex h-full items-center justify-center overflow-y-auto p-6">
                <EmptyState
                    module="whiteboard"
                    title={
                        reason === 'deleted'
                            ? t('This board was deleted.')
                            : t('Your access to this board has ended.')
                    }
                    description={
                        reason === 'deleted'
                            ? t('It is no longer available to anyone.')
                            : t('Ask the facilitator if you still need it.')
                    }
                    action={
                        teamUrl
                            ? {
                                  label: t('Back to the team'),
                                  href: teamUrl,
                                  variant: 'outline',
                              }
                            : undefined
                    }
                />
            </div>
        </SessionLayout>
    );
}
