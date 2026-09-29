import { useState, type FormEvent } from 'react';
import RetroSettingsController from '@/actions/App/Http/Controllers/Retros/RetroSettingsController';
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
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { BoardContextValue } from './board';

type Props = {
    ctx: BoardContextValue;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ ctx, open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <SettingsForm
                        ctx={ctx}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function SettingsForm({
    ctx,
    onDone,
}: {
    ctx: BoardContextValue;
    onDone: () => void;
}) {
    const { t } = useTrans();
    const { retro } = ctx.board;
    const [title, setTitle] = useState(retro.title);
    const [isAnonymous, setIsAnonymous] = useState(retro.isAnonymous);
    const [votes, setVotes] = useState(String(retro.votesPerParticipant));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const anonymityLocked = retro.isAnonymous && ctx.board.cards.length > 0;
    const votesLocked = !['writing', 'grouping'].includes(retro.phase);

    const save = async (event: FormEvent) => {
        event.preventDefault();

        const changes: Record<string, unknown> = {};

        if (title !== retro.title) {
            changes.title = title;
        }

        if (isAnonymous !== retro.isAnonymous) {
            changes.is_anonymous = isAnonymous;
        }

        if (Number(votes) !== retro.votesPerParticipant) {
            changes.votes_per_participant = Number(votes);
        }

        if (Object.keys(changes).length === 0) {
            onDone();

            return;
        }

        setSaving(true);
        setError(null);

        try {
            await retroRequest(
                RetroSettingsController.update(retro.id),
                changes,
            );
            await ctx.refetch();
            onDone();
        } catch (caught) {
            setError(
                caught instanceof RetroRequestError
                    ? caught.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
            <DialogTitle>{t('Retrospective settings')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="retro-title">{t('Title')}</Label>
                <Input
                    id="retro-title"
                    value={title}
                    maxLength={120}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                />
            </div>

            <div className="grid gap-1">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="retro-anonymous"
                        checked={isAnonymous}
                        disabled={anonymityLocked}
                        onCheckedChange={(checked) =>
                            setIsAnonymous(checked === true)
                        }
                    />
                    <Label htmlFor="retro-anonymous">
                        {t('Anonymous cards')}
                    </Label>
                </div>
                {anonymityLocked && (
                    <p className="text-xs text-muted-foreground">
                        {t(
                            'Anonymity can only be turned off before any card is written.',
                        )}
                    </p>
                )}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="retro-votes">
                    {t('Votes per participant')}
                </Label>
                <Input
                    id="retro-votes"
                    type="number"
                    min={1}
                    max={20}
                    value={votes}
                    disabled={votesLocked}
                    onChange={(event) => setVotes(event.target.value)}
                />
            </div>

            <InputError message={error ?? undefined} />

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
