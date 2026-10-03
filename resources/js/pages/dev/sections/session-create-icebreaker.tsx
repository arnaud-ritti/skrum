import { useState } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import {
    IcebreakerSessionFields,
    icebreakerSessionForm,
} from '@/components/teams/session-create/icebreaker-session-fields';
import type { IcebreakerSessionFormProps } from '@/components/teams/session-create/icebreaker-session-fields';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { GameOption } from '@/types';

export const group: BenchGroup = 'layouts';

/** Game names come from the server, already in the user's language: they are not translated here. */
const gameOptions: GameOption[] = [
    { value: 'draw', label: 'Draw & Guess', available: true },
    { value: 'gif', label: 'Sprint in one GIF', available: true },
    { value: 'hangman', label: 'Hangman', available: true },
    { value: 'decoded', label: 'Decoded', available: true },
    { value: 'two_truths', label: 'Two truths and a lie', available: true },
    { value: 'mood', label: 'Mood weather', available: true },
    { value: 'guess_who', label: 'Guess who?', available: true },
    { value: 'quick_question', label: 'Quick question', available: true },
];

const formProps: IcebreakerSessionFormProps = {
    workspaceSlug: 'nordlys',
    gameOptions,
    initialName: 'Friday warm-up',
};

const team = { id: 'atlas', name: 'Atlas' };

function WholeForm({
    name,
    ...props
}: Partial<IcebreakerSessionFormProps> & { name: string }) {
    const [footer, setFooter] = useState<HTMLElement | null>(null);

    return (
        <div
            data-slot="session-create-whole"
            data-state={name}
            className="max-w-244 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card"
        >
            <IcebreakerSessionFields
                {...formProps}
                {...props}
                context={{
                    type: 'icebreaker',
                    formId: `bench-icebreaker-form-${name}`,
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

export default function SessionCreateIcebreakerSection() {
    const { t } = useTrans();

    return (
        <div
            data-bench-section="session-create-icebreaker"
            className="flex flex-col gap-6 p-4 md:p-6"
        >
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t(
                        'New session, icebreaker form: the whole form, not scrolled',
                    )}
                </p>
                <WholeForm name="games" />
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t('New session, icebreaker form: no GIF provider')}
                </p>
                <WholeForm
                    name="unavailable"
                    gameOptions={gameOptions.map((option) => ({
                        ...option,
                        available: option.value !== 'gif',
                    }))}
                />
            </div>
            <BenchOverlayStage>
                <p className="text-xs text-muted-foreground">
                    {t('New session dialog, open on the icebreaker type')}
                </p>
                <NewSessionDialog
                    trigger={<Button>{t('New session')}</Button>}
                    team={team}
                    intent={{ type: 'icebreaker' }}
                    icebreaker={icebreakerSessionForm(formProps)}
                />
            </BenchOverlayStage>
        </div>
    );
}
