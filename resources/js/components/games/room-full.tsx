import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function RoomFull() {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">{t('This room is full.')}</p>
            <p className="text-muted-foreground">
                {t('Up to 12 players can be online at once.')}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
                {t('Try again')}
            </Button>
        </div>
    );
}
