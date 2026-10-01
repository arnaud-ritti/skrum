import { useState } from 'react';
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
    createdBy: { name: 'Ada Lovelace' },
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
    withEdit = false,
}: {
    initial: string;
    decks: Deck[];
    withEdit?: boolean;
}) {
    const [value, setValue] = useState(initial);

    return (
        <DeckPicker
            value={value}
            onValueChange={setValue}
            decks={decks}
            onCreate={() => undefined}
            onEdit={withEdit ? () => undefined : undefined}
        />
    );
}

function Editor({
    initial,
    errors,
    saving,
}: {
    initial: DeckDraft;
    errors?: { name?: string; values?: string };
    saving?: boolean;
}) {
    const [draft, setDraft] = useState(initial);

    return (
        <Card className="p-0">
            <DeckEditor
                value={draft}
                onChange={setDraft}
                errors={errors}
                saving={saving}
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
            <Example
                label={t(
                    'Picker: default card, hover (hover a card), create card',
                )}
            >
                <Picker initial="fibonacci" decks={builtinDecks} />
            </Example>
            <Example
                label={t(
                    'Picker: selected card, saved deck with author and edit button',
                )}
            >
                <Picker
                    initial="saved-1"
                    decks={[...builtinDecks, savedDeck]}
                    withEdit
                />
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
                    'Validation: value longer than 4 characters (type 12345 in the field)',
                )}
            >
                <Editor
                    initial={filledDraft}
                    errors={{
                        values: t('Values are :count characters at most.', {
                            count: 4,
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
