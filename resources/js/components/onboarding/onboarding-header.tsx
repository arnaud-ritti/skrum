import { PhaseStepper } from '@/components/skrum/phase-stepper';
import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';

export const OnboardingStepIds = [
    'workspace',
    'team',
    'invite',
    'ritual',
] as const;

export type OnboardingStepId = (typeof OnboardingStepIds)[number];

export function onboardingStepNumber(step: OnboardingStepId): number {
    return OnboardingStepIds.indexOf(step) + 1;
}

/**
 * The four steps in the header: done steps ticked, the
 * current one marked, nothing to click. `mobile` is the compact rail: a
 * marker per step and the current step's name.
 */
export function OnboardingStepper({
    step,
    mobile = false,
}: {
    step: OnboardingStepId;
    mobile?: boolean;
}) {
    const { t } = useTrans();

    return (
        <PhaseStepper
            variant="steps"
            mobile={mobile}
            phases={[
                { id: 'workspace', label: t('Workspace') },
                { id: 'team', label: t('Team') },
                { id: 'invite', label: t('Invite step') },
                { id: 'ritual', label: t('First ritual') },
            ]}
            current={step}
            className="*:justify-center"
        />
    );
}

/** The thin bar under the header (`.ob-prog`): halfway through the current step. */
export function OnboardingProgress({ step }: { step: OnboardingStepId }) {
    const { t } = useTrans();
    const number = onboardingStepNumber(step);
    const label = t('Step :n of 4', { n: number });

    return (
        <Progress
            value={number - 0.5}
            max={OnboardingStepIds.length}
            valueLabel=""
            aria-label={label}
            aria-valuetext={label}
            className="h-0.75 rounded-none bg-transparent ring-0"
        />
    );
}
