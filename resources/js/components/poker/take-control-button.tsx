import { Hand as HandIcon } from 'lucide-react';
import { useState } from 'react';
import PokerFacilitatorsController from '@/actions/App/Http/Controllers/Poker/PokerFacilitatorsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

export function TakeControlButton() {
    const { snapshot, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { me, game } = snapshot;

    if (!me.canTakeControl || me.userId === null) {
        return null;
    }

    const takeControl = async () => {
        setBusy(true);

        const result = await run(
            retroRequest(PokerFacilitatorsController.update(game.id), {
                user_id: me.userId,
            }),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return (
        <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void takeControl()}
        >
            <HandIcon className="size-4" />
            {t('Take control')}
        </Button>
    );
}
