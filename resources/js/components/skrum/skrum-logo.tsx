import { cn } from '@/lib/utils';

type Variant = 'horizontal' | 'symbol' | 'wordmark';

const ViewBoxes: Record<Variant, string> = {
    horizontal: '0 0 310 72',
    symbol: '0 0 64 64',
    wordmark: '0 0 228 70',
};

function SymbolPart() {
    return (
        <g data-part="symbol">
            <path
                className="fill-primary"
                d="M14 0 H50 A14 14 0 0 1 64 14 V46 L46 64 H14 A14 14 0 0 1 0 50 V14 A14 14 0 0 1 14 0 Z"
            />
            <path
                className="fill-primary brightness-75"
                d="M64 46 L50 46 A4 4 0 0 0 46 50 L46 64 Z"
            />
            <path
                className="fill-none stroke-primary-foreground"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 27 L19 38 C19 45 24 49.5 30 49.5 C36 49.5 41 45 41 38 L41 27"
            />
            <circle
                className="fill-primary-foreground"
                cx="21.5"
                cy="15.5"
                r="4.5"
            />
            <circle
                className="fill-primary-foreground"
                cx="38.5"
                cy="15.5"
                r="4.5"
            />
        </g>
    );
}

function WordmarkPart() {
    return (
        <g data-part="wordmark">
            <g
                className="fill-none stroke-foreground"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M27 31 C24 26 19 24 14 24 C7 24 2 28 2 34 C2 40 8 42 15 44 C22 46 28 48 28 54.5 C28 61 22 64 15 64 C9 64 4 61.5 1.5 57" />
                <path d="M43 4 L43 64" />
                <path d="M67 24 L44 47" />
                <path d="M53 38 L69 64" />
                <path d="M82 24 L82 64" />
                <path d="M82 42 C82 30 90 24 101 24" />
                <path d="M114 24 L114 46 C114 57 121 64 130 64 C139 64 146 57 146 46" />
                <path d="M146 24 L146 64" />
                <path d="M161 24 L161 64" />
                <path d="M161 38 C161 29 167 24 174.5 24 C182 24 187 29 187 38 L187 64" />
                <path d="M187 38 C187 29 193 24 200.5 24 C208 24 213 29 213 38 L213 64" />
            </g>
            <circle className="fill-primary" cx="117" cy="10" r="6" />
            <circle className="fill-chart-2" cx="143" cy="10" r="6" />
        </g>
    );
}

export function SkrumLogo({
    variant = 'horizontal',
    className,
    decorative = false,
}: {
    variant?: Variant;
    className?: string;
    decorative?: boolean;
}) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={ViewBoxes[variant]}
            role={decorative ? undefined : 'img'}
            aria-label={decorative ? undefined : 'Skrüm'}
            aria-hidden={decorative ? true : undefined}
            className={cn('shrink-0', className)}
        >
            {variant === 'symbol' && <SymbolPart />}
            {variant === 'wordmark' && (
                <g transform="translate(5 0)">
                    <WordmarkPart />
                </g>
            )}
            {variant === 'horizontal' && (
                <>
                    <g transform="scale(1.09375)">
                        <SymbolPart />
                    </g>
                    <g transform="translate(92 3)">
                        <WordmarkPart />
                    </g>
                </>
            )}
        </svg>
    );
}
