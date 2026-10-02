import { useState } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import {
    PokerSessionFields,
    pokerSessionForm,
} from '@/components/teams/session-create/poker-session-fields';
import type { PokerSessionFormProps } from '@/components/teams/session-create/poker-session-fields';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

/** Deck names come from the server, already in the user's language: they are not translated here. */
const formProps: PokerSessionFormProps = {
    workspaceSlug: 'nordlys',
    deckOptions: [
        {
            value: 'fibonacci',
            label: 'Fibonacci',
            cards: [
                '0',
                '1',
                '2',
                '3',
                '5',
                '8',
                '13',
                '21',
                '34',
                '55',
                '89',
                '?',
                '☕',
            ],
        },
        {
            value: 'modified_fibonacci',
            label: 'Modified Fibonacci',
            cards: [
                '0',
                '½',
                '1',
                '2',
                '3',
                '5',
                '8',
                '13',
                '20',
                '40',
                '100',
                '?',
                '☕',
            ],
        },
        {
            value: 'tshirt',
            label: 'T-shirt sizes',
            cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'],
        },
        {
            value: 'powers_of_two',
            label: 'Powers of 2',
            cards: ['1', '2', '4', '8', '16', '32', '64', '?'],
        },
        { value: 'custom', label: 'Custom', cards: [] },
    ],
    savedDecks: [
        {
            id: '0199a000-0000-7000-8000-00000000d001',
            name: 'Atlas · hours',
            cards: ['1', '2', '4', '8', '16', '?'],
            scope: 'team',
            canManage: true,
        },
        {
            id: '0199a000-0000-7000-8000-00000000d002',
            name: 'Nordlys story points',
            cards: ['1', '2', '3', '5', '8', '13', '?', '☕'],
            scope: 'workspace',
            canManage: false,
        },
    ],
    defaultPokerDeck: { deck: 'fibonacci', savedDeckId: null },
    initialTitle: 'Sprint 44 refinement',
};

const team = { id: 'atlas', name: 'Atlas' };

function WholeForm({
    name,
    ...props
}: Partial<PokerSessionFormProps> & { name: string }) {
    const [footer, setFooter] = useState<HTMLElement | null>(null);

    return (
        <div
            data-slot="session-create-whole"
            data-state={name}
            className="max-w-244 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card"
        >
            <PokerSessionFields
                {...formProps}
                {...props}
                context={{
                    type: 'poker',
                    formId: `bench-poker-form-${name}`,
                    team,
                    intent: null,
                    active: true,
                    footer,
                    close: () => {},
                }}
            />
            <div
                ref={setFooter}
                className="flex flex-wrap items-center gap-2 border-t px-4 py-3 md:px-6 md:py-4"
            />
        </div>
    );
}

export default function SessionCreatePokerSection() {
    const { t } = useTrans();

    return (
        <div
            data-bench-section="session-create-poker"
            className="flex flex-col gap-6 p-4 md:p-6"
        >
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t('New session, poker form: the whole form, not scrolled')}
                </p>
                <WholeForm
                    name="typed"
                    initialCustomDeck={{
                        name: '',
                        values: ['1', '2', '3', '5', '8'],
                        unknownCard: true,
                        breakCard: false,
                    }}
                    initialTasks={
                        'Export actions to CSV\nSSO with Microsoft Entra ID\nWebhook when a retro ends'
                    }
                />
            </div>
            <BenchOverlayStage>
                <p className="text-xs text-muted-foreground">
                    {t('New session dialog, open on the poker type')}
                </p>
                <NewSessionDialog
                    trigger={<Button>{t('New session')}</Button>}
                    team={team}
                    intent={{ type: 'poker' }}
                    poker={pokerSessionForm(formProps)}
                />
            </BenchOverlayStage>
        </div>
    );
}
