import { router } from '@inertiajs/react';
import { useState } from 'react';
import PokerGamesController from '@/actions/App/Http/Controllers/Poker/PokerGamesController';
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
import { dashboard } from '@/routes';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeleteGameDialog({ open, onOpenChange }: Props) {
    const ctx = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const destroy = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(PokerGamesController.destroy(ctx.snapshot.game.id)),
        );

        setBusy(false);

        if (result !== undefined) {
            router.visit(ctx.snapshot.links.team ?? dashboard().url);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Delete this game?')}</DialogTitle>
                <DialogDescription>
                    {t('Its tasks, rounds and votes are deleted for everyone.')}
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
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void destroy()}
                    >
                        {t('Delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
