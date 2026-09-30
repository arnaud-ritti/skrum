import { useTrans } from '@/hooks/use-trans';

const Parts = [
    <circle key="head" cx="140" cy="62" r="16" />,
    <line key="body" x1="140" y1="78" x2="140" y2="130" />,
    <line key="left-arm" x1="140" y1="92" x2="118" y2="112" />,
    <line key="right-arm" x1="140" y1="92" x2="162" y2="112" />,
    <line key="left-leg" x1="140" y1="130" x2="120" y2="160" />,
    <line key="right-leg" x1="140" y1="130" x2="160" y2="160" />,
];

type Props = { misses: number; maxMisses: number };

export function HangmanFigure({ misses, maxMisses }: Props) {
    const { t } = useTrans();
    const shown = Math.min(
        Parts.length,
        Math.round((misses * Parts.length) / Math.max(1, maxMisses)),
    );

    return (
        <svg
            viewBox="0 0 200 190"
            role="img"
            aria-label={t(':count of :max misses', {
                count: misses,
                max: maxMisses,
            })}
            className="h-40 w-auto text-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
        >
            <line x1="20" y1="180" x2="100" y2="180" />
            <line x1="60" y1="180" x2="60" y2="20" />
            <line x1="60" y1="20" x2="140" y2="20" />
            <line x1="140" y1="20" x2="140" y2="46" />
            {Parts.slice(0, shown)}
        </svg>
    );
}
