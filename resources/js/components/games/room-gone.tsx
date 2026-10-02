import { EmptyState } from '@/components/skrum/empty-state';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    reason: 'ended' | 'deleted';
    teamUrl: string | null;
};

export function RoomGone({ reason, teamUrl }: Props) {
    const { t } = useTrans();

    return (
        <main
            data-slot="room-gone"
            className="grid min-h-svh place-items-center bg-skrum-canvas p-6"
        >
            <EmptyState
                module="icebreaker"
                headingLevel="h2"
                title={
                    reason === 'deleted'
                        ? t('This room was deleted.')
                        : t('Your access to this room has ended.')
                }
                description={
                    reason === 'deleted'
                        ? t('Its rounds and scores are deleted for everyone.')
                        : t('Ask the host for a way back in.')
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
