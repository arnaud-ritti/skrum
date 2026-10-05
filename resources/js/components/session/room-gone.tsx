import { EmptyState } from '@/components/skrum/empty-state';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    module: 'poker' | 'icebreaker';
    title: string;
    description: string;
    teamUrl: string | null;
};

/** What a poker game or a game room shows once it was deleted or the viewer's access ended. */
export function RoomGone({ module, title, description, teamUrl }: Props) {
    const { t } = useTrans();

    return (
        <main
            data-slot="room-gone"
            className="grid min-h-svh place-items-center bg-skrum-canvas p-6"
        >
            <EmptyState
                module={module}
                headingLevel="h2"
                title={title}
                description={description}
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
