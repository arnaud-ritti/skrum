import { useForm, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import TeamPokerGamesController from '@/actions/App/Http/Controllers/TeamPokerGamesController';
import InputError from '@/components/input-error';
import {
    DeckFields,
    deckPayload,
    emptyDeckChoice,
    type DeckChoice,
} from '@/components/poker/deck-fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import type { PokerDeckOption } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    deckOptions: PokerDeckOption[];
};

type PokerGameForm = {
    title: string;
    anonymous_votes: boolean;
    auto_reveal: boolean;
};

export function NewPokerGameDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New game')}</Button>
            </DialogTrigger>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto"
            >
                {open && (
                    <NewPokerGameForm
                        {...props}
                        onDone={() => setOpen(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function NewPokerGameForm({
    workspaceSlug,
    teamId,
    deckOptions,
    onDone,
}: Props & { onDone: () => void }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [deck, setDeck] = useState<DeckChoice>(emptyDeckChoice);
    const form = useForm<PokerGameForm>({
        title: t('Poker :date', {
            date: new Date().toLocaleDateString(locale, {
                dateStyle: 'medium',
            }),
        }),
        anonymous_votes: false,
        auto_reveal: false,
    });
    const errors = form.errors as Record<string, string | undefined>;

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) => ({ ...data, ...deckPayload(deck) }));
        form.submit(
            TeamPokerGamesController.store({
                workspace: workspaceSlug,
                team: teamId,
            }),
            { onSuccess: onDone },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New game')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="new-poker-title">{t('Title')}</Label>
                <Input
                    id="new-poker-title"
                    value={form.data.title}
                    maxLength={120}
                    required
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                />
                <InputError message={form.errors.title} />
            </div>

            <DeckFields
                deckOptions={deckOptions}
                value={deck}
                onChange={setDeck}
                errors={errors}
            />

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="new-poker-anonymous"
                        checked={form.data.anonymous_votes}
                        onCheckedChange={(checked) =>
                            form.setData('anonymous_votes', checked === true)
                        }
                    />
                    <Label htmlFor="new-poker-anonymous">
                        {t('Anonymous votes')}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="new-poker-auto-reveal"
                        checked={form.data.auto_reveal}
                        onCheckedChange={(checked) =>
                            form.setData('auto_reveal', checked === true)
                        }
                    />
                    <Label htmlFor="new-poker-auto-reveal">
                        {t('Reveal automatically')}
                    </Label>
                </div>
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={form.processing}>{t('Create game')}</Button>
            </DialogFooter>
        </form>
    );
}
