import GameScoresController from '@/actions/App/Http/Controllers/Games/GameScoresController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
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

    const reset = async () => {
        const result = await ctx.run(
            retroRequest(GameScoresController.destroy(ctx.snapshot.room.id)),
        );

        if (result === undefined) {
            throw new Error('The scores were not reset.');
        }

        await ctx.refetch();
    };

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            tone="destructive"
            title={t('Reset scores')}
            description={t(
                'Scores in this room start again from zero. The team leaderboard keeps them.',
            )}
            confirmLabel={t('Reset scores')}
            onConfirm={reset}
        />
    );
}
