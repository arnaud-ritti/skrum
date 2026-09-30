import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';
import { BoardPostLink } from './board-post-link';

export function ShareBoardButton() {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const { integrations, retro } = board;

    if (
        retro.phase === 'completed' ||
        (!integrations.slack && !integrations.telegram)
    ) {
        return null;
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                disabled={sessionExpired}
                onClick={() => setOpen(true)}
            >
                <Share2 className="size-4" />
                {t('Share')}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Share the board')}</DialogTitle>
                    <BoardPostLink />
                </DialogContent>
            </Dialog>
        </>
    );
}
