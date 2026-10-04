import { useTrans } from '@/hooks/use-trans';

const Parts = [
    <circle key="head" cx="130" cy="50" r="16" />,
    <path key="body" d="M130 66 V110" />,
    <path key="left-arm" d="M130 78 L108 98" />,
    <path key="right-arm" d="M130 78 L152 98" />,
    <path key="left-leg" d="M130 110 L112 138" />,
    <path key="right-leg" d="M130 110 L148 138" />,
];

type Props = { misses: number; maxMisses: number };

/**
 * The parts still to lose are drawn dashed on a layer of their own, under
 * the figure, so the figure holds the gallows and the lost parts only.
 */
export function HangmanFigure({ misses, maxMisses }: Props) {
    const { t } = useTrans();
    const shown = Math.min(
        Parts.length,
        Math.round((misses * Parts.length) / Math.max(1, maxMisses)),
    );

    return (
        <div
            data-slot="hangman-figure"
            className="relative w-42 sm:w-50 [@media(max-height:43.75rem)]:w-28"
        >
            <svg
                viewBox="0 0 200 170"
                aria-hidden
                strokeDasharray="4 6"
                strokeLinecap="round"
                className="absolute inset-0 size-full fill-none stroke-border stroke-3"
            >
                {Parts.slice(shown)}
            </svg>
            <svg
                viewBox="0 0 200 170"
                role="img"
                aria-label={t(':count of :max misses', {
                    count: misses,
                    max: maxMisses,
                })}
                strokeLinecap="round"
                className="relative block h-auto w-full fill-none stroke-skrum-destructive-text stroke-4"
            >
                <path className="stroke-foreground" d="M20 160 H120" />
                <path className="stroke-foreground" d="M50 160 V14" />
                <path className="stroke-foreground" d="M50 14 H130 V34" />
                <path className="stroke-foreground" d="M50 44 L80 14" />
                {Parts.slice(0, shown)}
            </svg>
        </div>
    );
}
