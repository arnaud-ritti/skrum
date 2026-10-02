import { router } from '@inertiajs/react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
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

    const destroy = async () => {
        const result = await ctx.run(
            retroRequest(GameRoomsController.destroy(ctx.snapshot.room.id)),
        );

        if (result === undefined) {
            throw new Error('The room was not deleted.');
        }

        router.visit(ctx.snapshot.links.team ?? dashboard().url);
    };

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            tone="destructive"
            title={t('Delete this room?')}
            description={t('Its rounds and scores are deleted for everyone.')}
            confirmLabel={t('Delete')}
            onConfirm={destroy}
        />
    );
}
