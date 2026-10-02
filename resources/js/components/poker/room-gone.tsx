import { EmptyState } from '@/components/skrum/empty-state';
import { useTrans } from '@/hooks/use-trans';

export function RoomGone({
    reason,
    teamUrl,
}: {
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
}) {
    const { t } = useTrans();

    return (
        <main className="flex min-h-svh items-center justify-center bg-skrum-canvas p-6">
            <EmptyState
                module="poker"
                headingLevel="h2"
                title={
                    reason === 'deleted'
                        ? t('This game was deleted.')
                        : t('Your access to this game has ended.')
                }
                description={
                    reason === 'deleted'
                        ? t('Its tasks and its estimates went with it.')
                        : t('You can no longer open this game.')
                }
                action={
                    teamUrl === null
                        ? undefined
                        : {
                              label: t('Back to the team'),
                              href: teamUrl,
                              variant: 'outline',
                          }
                }
            />
        </main>
    );
}
