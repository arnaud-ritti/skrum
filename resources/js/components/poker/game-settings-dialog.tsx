import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import PokerSavedDecksController from '@/actions/App/Http/Controllers/Poker/PokerSavedDecksController';
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
import type { SavedPokerDeck } from '@/types';
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

function SettingSwitch({
    id,
    label,
    checked,
    onChange,
    children,
}: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    children?: ReactNode;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) => onChange(value === true)}
                />
                <Label htmlFor={id}>{label}</Label>
            </div>
            {children}
        </div>
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
    const [autoReveal, setAutoReveal] = useState(game.autoReveal);
    const [anonymousVotes, setAnonymousVotes] = useState(game.anonymousVotes);
    const [cursorsEnabled, setCursorsEnabled] = useState(game.cursorsEnabled);
    const [reactionsEnabled, setReactionsEnabled] = useState(
        game.reactionsEnabled,
    );
    const [errors, setErrors] = useState<Record<string, string | undefined>>(
        {},
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const deckLocked = game.hasVotes;
    const [savedDecks, setSavedDecks] = useState<SavedPokerDeck[]>([]);
    const canLoadSavedDecks = ctx.snapshot.me.isFacilitator && !deckLocked;

    useEffect(() => {
        if (!canLoadSavedDecks) {
            return;
        }

        let cancelled = false;

        retroRequest<SavedPokerDeck[]>(PokerSavedDecksController.index(game.id))
            .then((decks) => {
                if (!cancelled) {
                    setSavedDecks(decks ?? []);
                }
            })
            .catch(() => {
                // Built-in and custom decks still work without the list.
            });

        return () => {
            cancelled = true;
        };
    }, [canLoadSavedDecks, game.id]);

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

        if (autoReveal !== game.autoReveal) {
            changes.auto_reveal = autoReveal;
        }

        if (anonymousVotes !== game.anonymousVotes) {
            changes.anonymous_votes = anonymousVotes;
        }

        if (cursorsEnabled !== game.cursorsEnabled) {
            changes.cursors_enabled = cursorsEnabled;
        }

        if (reactionsEnabled !== game.reactionsEnabled) {
            changes.reactions_enabled = reactionsEnabled;
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
                    savedDecks={savedDecks}
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
            <SettingSwitch
                id="poker-auto-reveal"
                label={t(
                    'Reveal automatically when everyone has voted or the timer ends',
                )}
                checked={autoReveal}
                onChange={setAutoReveal}
            />
            <SettingSwitch
                id="poker-anonymous-votes"
                label={t('Anonymous votes')}
                checked={anonymousVotes}
                onChange={setAnonymousVotes}
            >
                {game.anonymousVotes && !anonymousVotes && (
                    <p className="text-xs text-muted-foreground">
                        {t('Applies from the next round.')}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    {t(
                        "With two voters, each can work out the other's vote from their own.",
                    )}
                </p>
            </SettingSwitch>
            <SettingSwitch
                id="poker-cursors"
                label={t('Show live cursors')}
                checked={cursorsEnabled}
                onChange={setCursorsEnabled}
            />
            <SettingSwitch
                id="poker-reactions"
                label={t('Show flying reactions')}
                checked={reactionsEnabled}
                onChange={setReactionsEnabled}
            />

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
