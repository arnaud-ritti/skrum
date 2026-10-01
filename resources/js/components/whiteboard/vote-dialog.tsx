import { useId, useState, type FormEvent } from 'react';
import WhiteboardVoteSessionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVoteSessionsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

type Props = {
    state: WhiteboardState;
    api: ExcalidrawImperativeAPI;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const AllNotes = 'all';

export function VoteDialog({ state, api, open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <VoteForm
                        state={state}
                        api={api}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function VoteForm({
    state,
    api,
    onClose,
}: {
    state: WhiteboardState;
    api: ExcalidrawImperativeAPI;
    onClose: () => void;
}) {
    const { t } = useTrans();
    const budgetId = useId();
    const scopeId = useId();
    const multipleId = useId();
    const [votesPerMember, setVotesPerMember] = useState(3);
    const [scope, setScope] = useState(AllNotes);
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [frames] = useState(() =>
        api
            .getSceneElements()
            .filter((element) => element.type === 'frame')
            .map((frame, position) => ({
                id: frame.id,
                name:
                    frame.name ?? t('Frame :number', { number: position + 1 }),
            })),
    );

    const start = async () => {
        setBusy(true);
        setError(undefined);

        try {
            await retroRequest<{ id: string }>(
                WhiteboardVoteSessionsController.store(state.snapshot.board.id),
                {
                    votes_per_member: votesPerMember,
                    frame_element_id: scope === AllNotes ? null : scope,
                    allow_multiple: allowMultiple,
                },
            );
            await state.refetch();
            onClose();
        } catch (caught) {
            setError(
                caught instanceof RetroRequestError && caught.status > 0
                    ? caught.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setBusy(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void start();
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Start a vote')}</DialogTitle>
            <div className="space-y-2">
                <Label htmlFor={budgetId}>{t('Votes per participant')}</Label>
                <Input
                    id={budgetId}
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={votesPerMember}
                    onChange={(event) =>
                        setVotesPerMember(Number(event.target.value))
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor={scopeId}>{t('Notes to vote on')}</Label>
                <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger id={scopeId}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={AllNotes}>
                            {t('All sticky notes')}
                        </SelectItem>
                        {frames.map((frame) => (
                            <SelectItem key={frame.id} value={frame.id}>
                                {t('Notes in :name', { name: frame.name })}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id={multipleId}
                    checked={allowMultiple}
                    onCheckedChange={(checked) =>
                        setAllowMultiple(checked === true)
                    }
                />
                <Label htmlFor={multipleId}>
                    {t('Allow several votes on one note')}
                </Label>
            </div>
            <InputError message={error} />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    {t('Cancel')}
                </Button>
                <Button disabled={busy}>{t('Start a vote')}</Button>
            </DialogFooter>
        </form>
    );
}
