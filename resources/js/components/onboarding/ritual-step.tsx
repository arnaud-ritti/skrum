import { ArrowRight, Dices, PenTool, Spade, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import OnboardingCompletionsController from '@/actions/App/Http/Controllers/OnboardingCompletionsController';
import {
    StepActions,
    StepFieldError,
    StepHeading,
} from '@/components/onboarding/step-layout';
import { useStepRequest } from '@/components/onboarding/use-step-request';
import { LoadingButton } from '@/components/skrum/loading-button';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export type Ritual = 'retro' | 'poker' | 'whiteboard' | 'icebreaker';

type Translate = ReturnType<typeof useTrans>['t'];

type RitualCard = {
    value: Ritual;
    icon: LucideIcon;
    color: ColumnColor;
    title: (t: Translate) => string;
    line: (t: Translate) => string;
    action: (t: Translate) => string;
};

/** The four cards of `.ob-rit`, with the icon and colour ScreenOnboarding gives each. */
const Rituals: RitualCard[] = [
    {
        value: 'retro',
        icon: StickyNote,
        color: 'moss',
        title: (t) => t('Retrospective'),
        line: (t) => t('Writing → vote → actions'),
        action: (t) => t('Create the retro'),
    },
    {
        value: 'poker',
        icon: Spade,
        color: 'sky',
        title: (t) => t('Planning poker'),
        line: (t) => t('Estimate the backlog'),
        action: (t) => t('Create the poker game'),
    },
    {
        value: 'whiteboard',
        icon: PenTool,
        color: 'sun',
        title: (t) => t('Whiteboard'),
        line: (t) => t('A free canvas'),
        action: (t) => t('Create the whiteboard'),
    },
    {
        value: 'icebreaker',
        icon: Dices,
        color: 'plum',
        title: (t) => t('Icebreaker'),
        line: (t) => t('5 minutes to warm up'),
        action: (t) => t('Create the icebreaker'),
    },
];

/**
 * Step 4, "What do you want to start with?": the first ritual. Either
 * button completes the onboarding; the primary one opens the team page with
 * the "New session" dialog on the chosen type.
 */
export function RitualStep() {
    const { t } = useTrans();
    const titleId = useId();
    const [ritual, setRitual] = useState<Ritual>('retro');
    const { pending, busy, errors, send } = useStepRequest<
        'create' | 'dashboard'
    >();
    const chosen = Rituals.find((card) => card.value === ritual) ?? Rituals[0];

    const submit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        send('create', 'post', OnboardingCompletionsController.store.url(), {
            ritual,
        });
    };

    return (
        <form
            data-slot="ritual-step"
            noValidate
            onSubmit={submit}
            className="flex min-w-0 flex-col gap-5"
        >
            <StepHeading
                number={4}
                title={t('What do you want to start with?')}
                titleId={titleId}
            />
            <RadioGroup<Ritual>
                aria-labelledby={titleId}
                value={ritual}
                onValueChange={setRitual}
                disabled={busy}
                className="gap-2 [&>input]:hidden"
            >
                {Rituals.map((card) => {
                    const Icon = card.icon;

                    return (
                        <RadioGroupCardItem
                            key={card.value}
                            value={card.value}
                            className="flex-row items-center gap-3 px-3 py-2 shadow-none"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'grid size-8 shrink-0 place-items-center rounded-md border border-(--col-border) bg-(--col) text-(--col-text)',
                                    `col-${card.color}`,
                                )}
                            >
                                <Icon className="size-4" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold">
                                    {card.title(t)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {card.line(t)}
                                </span>
                            </span>
                            <span
                                aria-hidden="true"
                                className="grid size-4 shrink-0 place-items-center rounded-full border border-input bg-card group-data-[state=checked]/radio-card:border-primary"
                            >
                                <span className="hidden size-2 rounded-full bg-primary group-data-[state=checked]/radio-card:block" />
                            </span>
                        </RadioGroupCardItem>
                    );
                })}
            </RadioGroup>
            <StepFieldError message={errors.ritual} />
            <StepActions className="justify-end">
                <LoadingButton
                    type="button"
                    variant="ghost"
                    loading={pending === 'dashboard'}
                    disabled={busy}
                    onClick={() =>
                        send(
                            'dashboard',
                            'post',
                            OnboardingCompletionsController.store.url(),
                        )
                    }
                >
                    {t('Go to the dashboard instead')}
                </LoadingButton>
                <LoadingButton
                    type="submit"
                    size="lg"
                    loading={pending === 'create'}
                    disabled={busy}
                >
                    {chosen.action(t)}
                    {pending !== 'create' && <ArrowRight aria-hidden="true" />}
                </LoadingButton>
            </StepActions>
        </form>
    );
}
