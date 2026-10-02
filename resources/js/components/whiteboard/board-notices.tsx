import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type BoardNoticesProps = {
    /** The board is locked and the viewer is not the facilitator. */
    locked: boolean;
    /** The viewer is the facilitator and everyone follows. */
    leading: boolean;
    following: boolean;
    paused: boolean;
    onResume: () => void;
};

/** What everyone on the board needs to know right now; nothing when calm. */
export function BoardNotices({
    locked,
    leading,
    following,
    paused,
    onResume,
}: BoardNoticesProps) {
    const { t } = useTrans();
    const isFollowing = following && !paused;

    if (!locked && !leading && !isFollowing && !paused) {
        return null;
    }

    return (
        <div
            role="status"
            data-slot="board-notices"
            className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b bg-muted px-4 py-1.5 text-sm"
        >
            {locked && (
                <span className="flex items-center gap-1.5">
                    <Lock className="size-4 shrink-0" aria-hidden />
                    {t('This board is locked.')}
                </span>
            )}
            {leading && <span>{t('Everyone follows your view.')}</span>}
            {isFollowing && <span>{t('Following the facilitator')}</span>}
            {paused && (
                <span className="flex items-center gap-2">
                    {t('Following paused')}
                    <Button size="sm" variant="outline" onClick={onResume}>
                        {t('Resume')}
                    </Button>
                </span>
            )}
        </div>
    );
}
