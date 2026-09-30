import { router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import PokerDecksController from '@/actions/App/Http/Controllers/PokerDecksController';
import InputError from '@/components/input-error';
import { splitCustomCards } from '@/components/poker/deck-fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard, SpecialCards } from '@/lib/poker/types';
import type { SavedPokerDeck } from '@/types';

const [UnknownCard, CoffeeCard] = SpecialCards;

type Props = {
    workspaceSlug: string;
    teamId: string;
    decks: SavedPokerDeck[];
};

type Draft = {
    name: string;
    cards: string;
    includeUnknown: boolean;
    includeCoffee: boolean;
};

const EmptyDraft: Draft = {
    name: '',
    cards: '',
    includeUnknown: true,
    includeCoffee: true,
};

function draftFrom(deck: SavedPokerDeck): Draft {
    return {
        name: deck.name,
        cards: deck.cards.filter((card) => !isSpecialCard(card)).join(', '),
        includeUnknown: deck.cards.includes(UnknownCard),
        includeCoffee: deck.cards.includes(CoffeeCard),
    };
}

function reloadDecks() {
    router.reload({ only: ['pokerDecks'] });
}

export function SavedDecksDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">{t('Saved decks')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                <DialogTitle>{t('Saved decks')}</DialogTitle>
                {open && <SavedDecksManager {...props} />}
            </DialogContent>
        </Dialog>
    );
}

function SavedDecksManager({ workspaceSlug, teamId, decks }: Props) {
    const { t } = useTrans();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const params = { workspace: workspaceSlug, team: teamId };

    const remove = (deck: SavedPokerDeck) => {
        router.delete(
            PokerDecksController.destroy({ ...params, pokerDeck: deck.id }).url,
            {
                preserveScroll: true,
                onSuccess: () => setConfirmingId(null),
                onHttpException: () => {
                    setConfirmingId(null);
                    reloadDecks();

                    return false;
                },
            },
        );
    };

    return (
        <div className="space-y-4">
            {decks.length === 0 && !creating && (
                <p className="text-sm text-muted-foreground">
                    {t('No saved decks yet.')}
                </p>
            )}

            <ul className="divide-y rounded-md border">
                {decks.map((deck) => (
                    <li key={deck.id} className="space-y-2 p-3">
                        {editingId === deck.id ? (
                            <DeckDraftForm
                                params={params}
                                deck={deck}
                                onDone={() => setEditingId(null)}
                            />
                        ) : (
                            <>
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium">
                                            {deck.name}
                                        </p>
                                        <p className="mt-1 flex flex-wrap gap-1">
                                            {deck.cards.map((card) => (
                                                <span
                                                    key={card}
                                                    className="min-w-6 rounded border px-1 text-center font-mono text-xs"
                                                >
                                                    {card}
                                                </span>
                                            ))}
                                        </p>
                                    </div>
                                    {deck.canManage && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setEditingId(deck.id)
                                                }
                                            >
                                                {t('Edit deck')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setConfirmingId(deck.id)
                                                }
                                            >
                                                {t('Delete deck')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {confirmingId === deck.id && (
                                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-sm">
                                        <span>
                                            {t('Delete this deck?')}{' '}
                                            {t(
                                                'Games that use it keep their cards.',
                                            )}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => remove(deck)}
                                        >
                                            {t('Delete deck')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() =>
                                                setConfirmingId(null)
                                            }
                                        >
                                            {t('Cancel')}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </li>
                ))}
            </ul>

            {creating ? (
                <DeckDraftForm
                    params={params}
                    deck={null}
                    onDone={() => setCreating(false)}
                />
            ) : (
                <Button onClick={() => setCreating(true)}>
                    {t('New deck')}
                </Button>
            )}
        </div>
    );
}

function DeckDraftForm({
    params,
    deck,
    onDone,
}: {
    params: { workspace: string; team: string };
    deck: SavedPokerDeck | null;
    onDone: () => void;
}) {
    const { t } = useTrans();
    const [draft, setDraft] = useState<Draft>(() =>
        deck ? draftFrom(deck) : EmptyDraft,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const idPrefix = deck ? `deck-${deck.id}` : 'deck-new';
    const cardsError =
        errors.cards ??
        Object.entries(errors).find(([key]) => key.startsWith('cards.'))?.[1];

    const update = (changes: Partial<Draft>) =>
        setDraft((current) => ({ ...current, ...changes }));

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const payload = {
            name: draft.name,
            cards: splitCustomCards(draft.cards),
            include_unknown: draft.includeUnknown,
            include_coffee: draft.includeCoffee,
        };
        const options = {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: onDone,
            onError: (formErrors: Record<string, string>) =>
                setErrors(formErrors),
            onHttpException: () => {
                reloadDecks();
                onDone();

                return false;
            },
        };

        if (deck) {
            router.patch(
                PokerDecksController.update({ ...params, pokerDeck: deck.id })
                    .url,
                payload,
                options,
            );

            return;
        }

        router.post(PokerDecksController.store(params).url, payload, options);
    };

    return (
        <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>{t('Deck name')}</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={draft.name}
                    maxLength={40}
                    required
                    onChange={(event) => update({ name: event.target.value })}
                />
                <InputError message={errors.name} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-cards`}>{t('Custom cards')}</Label>
                <Input
                    id={`${idPrefix}-cards`}
                    value={draft.cards}
                    placeholder="1, 2, 3, 5, 8"
                    required
                    onChange={(event) => update({ cards: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    {t('Separate cards with commas.')}
                </p>
                <InputError message={cardsError} />
            </div>
            <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${idPrefix}-unknown`}
                        checked={draft.includeUnknown}
                        onCheckedChange={(checked) =>
                            update({ includeUnknown: checked === true })
                        }
                    />
                    <Label htmlFor={`${idPrefix}-unknown`}>
                        {t('Add :card', { card: UnknownCard })}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${idPrefix}-coffee`}
                        checked={draft.includeCoffee}
                        onCheckedChange={(checked) =>
                            update({ includeCoffee: checked === true })
                        }
                    />
                    <Label htmlFor={`${idPrefix}-coffee`}>
                        {t('Add :card', { card: CoffeeCard })}
                    </Label>
                </div>
            </div>
            <div className="flex gap-2">
                <Button disabled={processing}>{t('Save')}</Button>
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
            </div>
        </form>
    );
}
