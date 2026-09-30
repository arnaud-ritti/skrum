import { useState, type FormEvent } from 'react';
import PokerSettingsController from '@/actions/App/Http/Controllers/Poker/PokerSettingsController';
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
import {
    deckChoiceFromGame,
    DeckFields,
    deckPayload,
    type DeckChoice,
} from './deck-fields';
import { useGame } from './game-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function GameSettingsDialog({ open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                {open && <SettingsForm onDone={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function firstErrors(
    errors: Record<string, string[]>,
): Record<string, string | undefined> {
    return Object.fromEntries(
        Object.entries(errors).map(([key, messages]) => [key, messages[0]]),
    );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
    const ctx = useGame();
    const { t } = useTrans();
    const { game } = ctx.snapshot;
    const initialDeck = deckChoiceFromGame(game);
    const [title, setTitle] = useState(game.title);
    const [deck, setDeck] = useState<DeckChoice>(initialDeck);
    const [guestAccessEnabled, setGuestAccessEnabled] = useState(
        game.guestAccessEnabled,
    );
    const [errors, setErrors] = useState<Record<string, string | undefined>>(
        {},
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const deckLocked = game.hasVotes;

    const save = async (event: FormEvent) => {
        event.preventDefault();

        const changes: Record<string, unknown> = {};

        if (title !== game.title) {
            changes.title = title;
        }

        const deckChanges = deckPayload(deck);

        if (
            !deckLocked &&
            JSON.stringify(deckChanges) !==
                JSON.stringify(deckPayload(initialDeck))
        ) {
            Object.assign(changes, deckChanges);
        }

        if (guestAccessEnabled !== game.guestAccessEnabled) {
            changes.guest_access_enabled = guestAccessEnabled;
        }

        if (Object.keys(changes).length === 0) {
            onDone();

            return;
        }

        setSaving(true);
        setError(null);
        setErrors({});

        try {
            await retroRequest(
                PokerSettingsController.update(game.id),
                changes,
            );
            await ctx.refetch();
            onDone();
        } catch (caught) {
            const message = ctx.handleError(caught);

            if (message === null) {
                onDone();

                return;
            }

            if (caught instanceof RetroRequestError) {
                setErrors(firstErrors(caught.errors));
            }

            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(event) => void save(event)} className="space-y-4">
            <DialogTitle>{t('Game settings')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="poker-title">{t('Title')}</Label>
                <Input
                    id="poker-title"
                    value={title}
                    maxLength={120}
                    required
                    onChange={(event) => setTitle(event.target.value)}
                />
                <InputError message={errors.title} />
            </div>

            <div className="space-y-2">
                <DeckFields
                    deckOptions={ctx.deckOptions}
                    value={deck}
                    onChange={setDeck}
                    disabled={deckLocked}
                    errors={errors}
                />
                {deckLocked && (
                    <p className="text-xs text-muted-foreground">
                        {t("The deck can't change once votes exist.")}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    id="poker-guest-access"
                    checked={guestAccessEnabled}
                    onCheckedChange={(checked) =>
                        setGuestAccessEnabled(checked === true)
                    }
                />
                <Label htmlFor="poker-guest-access">{t('Allow guests')}</Label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={saving}>{t('Save')}</Button>
            </DialogFooter>
        </form>
    );
}
