import { useState } from 'react';
import WhiteboardFacilitatorsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController';
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
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';

type Props = {
    state: WhiteboardState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function HandOverDialog({ state, open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <HandOverForm
                        state={state}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function HandOverForm({
    state,
    onClose,
}: {
    state: WhiteboardState;
    onClose: () => void;
}) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const [userId, setUserId] = useState('');
    const [busy, setBusy] = useState(false);
    const { board, me } = state.snapshot;
    const candidates = me.transferCandidates;

    const handOver = async () => {
        setBusy(true);

        const done = await request(
            retroRequest(WhiteboardFacilitatorsController.update(board.id), {
                user_id: userId,
            }),
        );

        setBusy(false);

        if (done === undefined) {
            return;
        }

        await state.refetch();
        onClose();
    };

    return (
        <>
            <DialogTitle>{t('Hand over facilitation')}</DialogTitle>

            {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No one else can facilitate this board yet.')}
                </p>
            ) : (
                <div className="grid gap-2">
                    <Label htmlFor="whiteboard-new-facilitator">
                        {t('New facilitator')}
                    </Label>
                    <Select value={userId} onValueChange={setUserId}>
                        <SelectTrigger id="whiteboard-new-facilitator">
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
                <Button type="button" variant="secondary" onClick={onClose}>
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
        </>
    );
}
