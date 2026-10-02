import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { DeckEditor } from '@/components/skrum/deck-editor';
import type { DeckDraft } from '@/components/skrum/deck-editor';
import { DeckPicker } from '@/components/skrum/deck-picker';
import type { Deck } from '@/components/skrum/deck-picker';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const builtinDecks: Deck[] = [
    {
        id: 'fibonacci',
        name: 'Fibonacci',
        values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89'],
        unknownCard: true,
        breakCard: true,
        source: 'builtin',
    },
    {
        id: 'modified',
        name: 'Modified Fibonacci',
        values: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100'],
        unknownCard: true,
        breakCard: true,
        source: 'builtin',
    },
    {
        id: 'tshirt',
        name: 'T-shirt',
        values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        unknownCard: true,
        breakCard: false,
        source: 'builtin',
    },
    {
        id: 'powers',
        name: 'Powers of 2',
        values: ['1', '2', '4', '8', '16', '32', '64'],
        unknownCard: true,
        breakCard: false,
        source: 'builtin',
    },
];

const savedDeck: Deck = {
    id: 'saved-1',
    name: 'Team sizes',
    values: ['1', '2', '3', '5', '8'],
    unknownCard: false,
    breakCard: false,
    source: 'saved',
    canManage: true,
    createdBy: { name: 'Ada Lovelace' },
};

const readOnlyDeck: Deck = {
    id: 'saved-2',
    name: 'Bug sizes',
    values: ['S', 'M', 'L'],
    unknownCard: true,
    breakCard: false,
    source: 'saved',
    canManage: false,
};

const extremeValues = Array.from({ length: 20 }, (_, index) =>
    `${index + 1} points`.slice(0, 8),
);

const extremeDeck: Deck = {
    id: 'saved-3',
    name: 'Estimates of the platform team 2026 (v2)',
    values: extremeValues,
    unknownCard: true,
    breakCard: true,
    source: 'saved',
    canManage: true,
};

const filledDraft: DeckDraft = {
    name: 'Team sizes',
    values: ['½', '1', '2', '3', '5', '8', '13'],
    unknownCard: true,
    breakCard: false,
};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Picker({
    initial,
    decks,
    withManage = false,
}: {
    initial: string;
    decks: Deck[];
    withManage?: boolean;
}) {
    const [value, setValue] = useState(initial);
    const [current, setCurrent] = useState(decks);

    return (
        <DeckPicker
            value={value}
            onValueChange={setValue}
            decks={current}
            onCreate={() => undefined}
            onEdit={withManage ? () => undefined : undefined}
            onDelete={
                withManage
                    ? (id) =>
                          setCurrent((list) =>
                              list.filter((deck) => deck.id !== id),
                          )
                    : undefined
            }
        />
    );
}

function PickerWithOpenConfirmation({ decks }: { decks: Deck[] }) {
    const containerRef = useRef<HTMLDivElement>(null);

    // The dialog is fixed to the viewport: this state comes first and fills one
    // viewport, so the dialog covers nothing else in a full-page capture.
    useEffect(() => {
        containerRef.current
            ?.querySelector<HTMLButtonElement>(
                '[data-slot="deck-manage"] button:last-of-type',
            )
            ?.click();
    }, []);

    return (
        <div ref={containerRef} className="min-h-dvh">
            <Picker initial="saved-1" decks={decks} withManage />
        </div>
    );
}

function Editor({
    initial,
    errors,
    saving,
    nameRequired,
    saveLabel,
}: {
    initial: DeckDraft;
    errors?: { name?: string; values?: string };
    saving?: boolean;
    nameRequired?: boolean;
    saveLabel?: string;
}) {
    const [draft, setDraft] = useState(initial);

    return (
        <Card className="p-0">
            <DeckEditor
                value={draft}
                onChange={setDraft}
                errors={errors}
                saving={saving}
                nameRequired={nameRequired}
                saveLabel={saveLabel}
                onSave={() => undefined}
                onCancel={() => undefined}
            />
        </Card>
    );
}

export default function DeckPickerSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Picker: delete confirmation open')}>
                <PickerWithOpenConfirmation decks={[savedDeck]} />
            </Example>
            <Example
                label={t(
                    'Picker: default card, hover (hover a card), create card',
                )}
            >
                <Picker initial="fibonacci" decks={builtinDecks} />
            </Example>
            <Example
                label={t(
                    'Picker: selected card, saved deck with author, edit and delete (delete asks for confirmation); a saved deck the user cannot manage has neither',
                )}
            >
                <Picker
                    initial="saved-1"
                    decks={[...builtinDecks, savedDeck, readOnlyDeck]}
                    withManage
                />
            </Example>
            <Example label={t('Picker: no deck at all')}>
                <Picker initial="" decks={[]} />
            </Example>
            <Example
                label={t(
                    'Picker: 20 values of 8 characters and a 40-character name, narrow container (20rem)',
                )}
            >
                <div className="w-80 max-w-full">
                    <Picker
                        initial="saved-3"
                        decks={[extremeDeck]}
                        withManage
                    />
                </div>
            </Example>
            <Example label={t('Picker: narrow container (20rem)')}>
                <div className="w-80 max-w-full">
                    <Picker initial="tshirt" decks={builtinDecks.slice(0, 3)} />
                </div>
            </Example>
            <Example
                label={t(
                    'Editor: filled deck, special card off in the preview, double-click or press Enter on a chip to edit it',
                )}
            >
                <Editor initial={filledDraft} />
            </Example>
            <Example
                label={t(
                    'Editor: one-off custom deck, name optional, in a 20rem container',
                )}
            >
                <div className="w-80 max-w-full">
                    <Editor
                        initial={{ ...filledDraft, name: '' }}
                        nameRequired={false}
                        saveLabel={t('Use these cards')}
                    />
                </div>
            </Example>
            <Example
                label={t(
                    'Editor: 20 values of 8 characters (the field refuses a 21st)',
                )}
            >
                <Editor
                    initial={{
                        name: extremeDeck.name,
                        values: extremeValues,
                        unknownCard: true,
                        breakCard: true,
                    }}
                />
            </Example>
            <Example label={t('Editor: empty (create mode), save disabled')}>
                <Editor
                    initial={{
                        name: '',
                        values: [],
                        unknownCard: true,
                        breakCard: true,
                    }}
                />
            </Example>
            <Example label={t('Validation: fewer than 2 values')}>
                <Editor
                    initial={{ ...filledDraft, values: ['5'] }}
                    errors={{ values: t('Add at least 2 values.') }}
                />
            </Example>
            <Example
                label={t(
                    'Validation: duplicate value (type 8 in the field to see the live refusal)',
                )}
            >
                <Editor
                    initial={filledDraft}
                    errors={{ values: t('Duplicate value: 8') }}
                />
            </Example>
            <Example
                label={t(
                    'Validation: value longer than 8 characters (type 123456789 in the field)',
                )}
            >
                <Editor
                    initial={filledDraft}
                    errors={{
                        values: t('Values are :count characters at most.', {
                            count: 8,
                        }),
                    }}
                />
            </Example>
            <Example label={t('Validation: name error from the server')}>
                <Editor
                    initial={filledDraft}
                    errors={{ name: t('This name is already used.') }}
                />
            </Example>
            <Example label={t('Saving: spinner, save disabled')}>
                <Editor initial={filledDraft} saving />
            </Example>
        </div>
    );
}
