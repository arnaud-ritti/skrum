import { useTrans } from '@/hooks/use-trans';
import { formatDecimal } from '@/lib/surveys/format';
import { cn } from '@/lib/utils';

export type RotiStep = 1 | 2 | 3 | 4 | 5;

/** The fill of each step of the ROTI scale; what is written on it takes `text-skrum-roti-foreground`. */
export const rotiBackground: Record<RotiStep, string> = {
    1: 'bg-skrum-roti-1',
    2: 'bg-skrum-roti-2',
    3: 'bg-skrum-roti-3',
    4: 'bg-skrum-roti-4',
    5: 'bg-skrum-roti-5',
};

/** The step of the scale a ROTI reads as: an average takes the step it rounds to. */
export function rotiStep(value: number): RotiStep {
    return Math.min(5, Math.max(1, Math.round(value))) as RotiStep;
}

/**
 * A ROTI with one decimal on the fill of its step, as the scale of the ROTI
 * screen writes its numbers: the tokens of the scale are fills, too light to
 * be read as a text colour on a card. Digits have no descender and sit about
 * a pixel above the middle of their line: the chip gives that pixel back
 * above them, and takes it off its margins so that a line holding a chip is
 * no taller than one without.
 */
export function RotiValue({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    const step = rotiStep(value);

    return (
        <span
            data-slot="roti-value"
            data-step={step}
            className={cn(
                '-my-px inline-flex items-center justify-center rounded-sm px-1 pt-0.75 pb-0.5 leading-none font-semibold text-skrum-roti-foreground tabular-nums',
                rotiBackground[step],
                className,
            )}
        >
            {formatDecimal(value)}
        </span>
    );
}

/** The ROTI of a retro in a line of text: the word, the value in its colour, then the rest of the outcome. */
export function RotiOutcome({
    value,
    rest,
}: {
    value: number;
    rest?: string | null;
}) {
    const { t } = useTrans();

    return (
        <>
            <span className="inline-flex items-baseline gap-1.5">
                {t('ROTI')} <RotiValue value={value} />
            </span>
            {rest != null && rest !== '' && ` · ${rest}`}
        </>
    );
}
