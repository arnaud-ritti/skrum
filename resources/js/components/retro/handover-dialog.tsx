import { useState } from 'react';
import RetroFacilitatorsController from '@/actions/App/Http/Controllers/Retros/RetroFacilitatorsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardContextValue } from './board';

type Props = {
    ctx: BoardContextValue;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function HandoverDialog({ ctx, open, onOpenChange }: Props) {
    const { t } = useTrans();
    const [userId, setUserId] = useState('');
    const [busy, setBusy] = useState(false);
    const candidates = ctx.board.viewer.transferCandidates;

    const handOver = async () => {
        setBusy(true);

        const result = await ctx.run(
            retroRequest(
                RetroFacilitatorsController.update(ctx.board.retro.id),
                {
                    user_id: userId,
                },
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            await ctx.refetch();
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Hand over facilitation')}</DialogTitle>

                {candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'No one else can facilitate this retrospective yet.',
                        )}
                    </p>
                ) : (
                    <div className="grid gap-2">
                        <Label htmlFor="new-facilitator">
                            {t('New facilitator')}
                        </Label>
                        <Select value={userId} onValueChange={setUserId}>
                            <SelectTrigger id="new-facilitator">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {candidates.map((candidate) => (
                                    <SelectItem
                                        key={candidate.userId}
                                        value={candidate.userId}
                                    >
                                        {candidate.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('Cancel')}
                    </Button>
                    {candidates.length > 0 && (
                        <Button
                            disabled={busy || userId === ''}
                            onClick={() => void handOver()}
                        >
                            {t('Hand over')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
