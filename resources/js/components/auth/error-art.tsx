export type ErrorArtKind = 'missing' | 'locked' | 'broken' | 'clock';

const line = 'fill-none stroke-muted-foreground opacity-50';
const shadow = 'fill-muted stroke-none';
const dot = 'fill-primary stroke-none';

/** Geometric sticky notes under the two dots of the logo; never a character. */
export function ErrorArt({ kind }: { kind: ErrorArtKind }) {
    return (
        <svg
            data-slot="error-art"
            data-kind={kind}
            aria-hidden="true"
            viewBox="0 0 160 110"
            strokeWidth={1.2}
            strokeLinecap="round"
            className="mb-1 h-27.5 w-40 shrink-0"
        >
            {kind === 'missing' && (
                <>
                    <circle className={dot} cx="72" cy="12" r="4" />
                    <circle className={dot} cx="88" cy="12" r="4" />
                    <rect
                        className="fill-skrum-col-moss stroke-skrum-col-moss-border"
                        x="14"
                        y="30"
                        width="40"
                        height="40"
                        rx="5"
                    />
                    <path className={line} d="M22 42 H44 M22 50 H36" />
                    <rect
                        className="fill-none stroke-input"
                        strokeDasharray="4 4"
                        x="60"
                        y="30"
                        width="40"
                        height="40"
                        rx="5"
                    />
                    <g transform="rotate(16 128 74)">
                        <path
                            className="fill-skrum-col-sun stroke-skrum-col-sun-border"
                            d="M108 52 H148 V84 L140 92 H108 Z"
                        />
                        <path
                            className="fill-skrum-col-sun-border stroke-none"
                            d="M148 84 H142 A2 2 0 0 0 140 86 V92 Z"
                        />
                        <path className={line} d="M116 64 H138 M116 72 H130" />
                    </g>
                    <ellipse
                        className={shadow}
                        cx="80"
                        cy="103"
                        rx="56"
                        ry="4"
                    />
                </>
            )}
            {kind === 'locked' && (
                <>
                    <circle className={dot} cx="72" cy="10" r="4" />
                    <circle className={dot} cx="88" cy="10" r="4" />
                    <path
                        className="fill-skrum-col-coral stroke-skrum-col-coral-border"
                        d="M48 22 H112 V86 L102 96 H48 Z"
                    />
                    <path
                        className="fill-skrum-col-coral-border stroke-none"
                        d="M112 86 H104 A2 2 0 0 0 102 88 V96 Z"
                    />
                    <path
                        className="fill-none stroke-skrum-col-coral-text"
                        strokeWidth={4}
                        d="M68 52 V44 A12 12 0 0 1 92 44 V52"
                    />
                    <rect
                        className="fill-card stroke-skrum-col-coral-text"
                        strokeWidth={1.5}
                        x="62"
                        y="52"
                        width="36"
                        height="28"
                        rx="5"
                    />
                    <circle
                        className="fill-skrum-col-coral-text stroke-none"
                        cx="80"
                        cy="63"
                        r="3.5"
                    />
                    <path
                        className="stroke-skrum-col-coral-text"
                        strokeWidth={3}
                        d="M80 66 V72"
                    />
                    <ellipse
                        className={shadow}
                        cx="80"
                        cy="104"
                        rx="44"
                        ry="4"
                    />
                </>
            )}
            {kind === 'broken' && (
                <>
                    <circle className={dot} cx="66" cy="12" r="4" />
                    <circle className={dot} cx="86" cy="18" r="4" />
                    <g transform="rotate(-7 60 60)">
                        <path
                            className="fill-skrum-col-apricot stroke-skrum-col-apricot-border"
                            d="M40 30 H78 L72 44 L80 56 L72 70 L78 86 H40 Z"
                        />
                        <path className={line} d="M48 44 H64 M48 52 H60" />
                    </g>
                    <g transform="rotate(9 104 62)">
                        <path
                            className="fill-skrum-col-apricot stroke-skrum-col-apricot-border"
                            d="M86 32 H122 V78 L112 88 H86 L80 72 L88 58 L80 46 Z"
                        />
                        <path
                            className="fill-skrum-col-apricot-border stroke-none"
                            d="M122 78 H114 A2 2 0 0 0 112 80 V88 Z"
                        />
                        <path className={line} d="M96 46 H112" />
                    </g>
                    <ellipse
                        className={shadow}
                        cx="80"
                        cy="103"
                        rx="52"
                        ry="4"
                    />
                </>
            )}
            {kind === 'clock' && (
                <>
                    <circle className={dot} cx="72" cy="10" r="4" />
                    <circle className={dot} cx="88" cy="10" r="4" />
                    <path
                        className="fill-skrum-col-sky stroke-skrum-col-sky-border"
                        d="M46 22 H114 V84 L104 94 H46 Z"
                    />
                    <path
                        className="fill-skrum-col-sky-border stroke-none"
                        d="M114 84 H106 A2 2 0 0 0 104 86 V94 Z"
                    />
                    <circle
                        className="fill-card stroke-skrum-col-sky-text"
                        strokeWidth={2}
                        cx="80"
                        cy="56"
                        r="22"
                    />
                    <path
                        className="fill-none stroke-primary"
                        strokeWidth={3.5}
                        strokeLinejoin="round"
                        d="M80 42 V56 L90 62"
                    />
                    <circle
                        className="fill-skrum-col-sky-text stroke-none"
                        cx="80"
                        cy="56"
                        r="2.5"
                    />
                    <ellipse
                        className={shadow}
                        cx="80"
                        cy="103"
                        rx="44"
                        ry="4"
                    />
                </>
            )}
        </svg>
    );
}
