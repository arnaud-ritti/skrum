import { router } from '@inertiajs/react';
import { useState } from 'react';
import RetrosController from '@/actions/App/Http/Controllers/Retros/RetrosController';
import { dashboard } from '@/routes';
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
import type { BoardContextValue } from './board';

type Props = {
    ctx: BoardContextValue;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function DeleteRetroDialog({ ctx, open, onOpenChange }: Props) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const destroy = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(RetrosController.destroy(ctx.board.retro.id)),
        );

        setBusy(false);

        if (result !== undefined) {
            router.visit(ctx.board.links.team ?? dashboard().url);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('Delete retrospective')}</DialogTitle>
                <DialogDescription>
                    {t(
                        'Delete this retrospective? Everyone loses access to it.',
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
