import { useState } from 'react';
import GameScoresController from '@/actions/App/Http/Controllers/Games/GameScoresController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ResetScoresDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const reset = async () => {
        setBusy(true);

        try {
            const result = await ctx.run(
                retroRequest(
                    GameScoresController.destroy(ctx.snapshot.room.id),
                ),
            );

            if (result === undefined) {
                return;
            }

            await ctx.refetch();
            onOpenChange(false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Reset scores')}</DialogTitle>
                <DialogDescription>
                    {t(
                        'Scores in this room start again from zero. The team leaderboard keeps them.',
                    )}
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void reset()}
                    >
                        {t('Reset scores')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
