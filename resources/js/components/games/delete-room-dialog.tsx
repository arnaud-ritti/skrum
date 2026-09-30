import { router } from '@inertiajs/react';
import { useState } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
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
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeleteRoomDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const destroy = async () => {
        setBusy(true);

        let result: unknown;

        try {
            result = await ctx.run(
                retroRequest(GameRoomsController.destroy(ctx.snapshot.room.id)),
            );
        } finally {
            setBusy(false);
        }

        if (result !== undefined) {
            router.visit(ctx.snapshot.links.team ?? dashboard().url);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Delete this room?')}</DialogTitle>
                <DialogDescription>
                    {t('Its rounds and scores are deleted for everyone.')}
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
