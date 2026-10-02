import { RotateCw } from 'lucide-react';
import { EmptyState } from '@/components/skrum/empty-state';
import { useTrans } from '@/hooks/use-trans';

export function RoomFull() {
    const { t } = useTrans();

    return (
        <main
            data-slot="room-full"
            className="grid min-h-svh place-items-center bg-skrum-canvas p-6"
        >
            <EmptyState
                module="icebreaker"
                headingLevel="h2"
                title={t('This room is full.')}
                description={t('Up to 12 players can be online at once.')}
                action={{
                    label: t('Try again'),
                    icon: RotateCw,
                    variant: 'outline',
                    onClick: () => window.location.reload(),
                }}
            />
        </main>
    );
}
