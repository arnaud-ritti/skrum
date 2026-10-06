import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type EmptyStateModule =
    | 'retro'
    | 'poker'
    | 'whiteboard'
    | 'survey'
    | 'icebreaker'
    | 'actions'
    | 'sessions';

export type EmptyStatePrimaryAction = {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    href?: NonNullable<InertiaLinkProps['href']>;
    variant?: 'default' | 'outline' | 'ghost';
};

export type EmptyStateSecondaryAction = {
    label: string;
    onClick?: () => void;
    href?: NonNullable<InertiaLinkProps['href']>;
};

export type EmptyStateProps = {
    module: EmptyStateModule;
    /** The overline, where the page is not named after the module of its drawing. */
    overline?: string;
    title: string;
    description: ReactNode;
    illustration?: boolean;
    action?: EmptyStatePrimaryAction;
    secondaryAction?: EmptyStateSecondaryAction;
    headingLevel?: 'h2' | 'h3';
    autoFocusAction?: boolean;
    className?: string;
};

const line =
    'fill-none stroke-muted-foreground stroke-[2.5] opacity-50 [stroke-linecap:round]';
const ink =
    'fill-none stroke-primary stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]';
const dash = 'fill-none stroke-input stroke-[1.5] [stroke-dasharray:4_4]';
const card = 'fill-card stroke-border';
const dot = 'fill-primary stroke-none';

function Illustration({ module }: { module: EmptyStateModule }) {
    return (
        <svg
            data-slot="empty-state-art"
            data-module={module}
            aria-hidden="true"
            viewBox="0 0 120 88"
            className="h-22 w-30 shrink-0 [&_path]:stroke-[1.2] [&_rect]:stroke-[1.2]"
        >
            {module === 'retro' && (
                <>
                    <circle className={dot} cx="52" cy="8" r="3.5" />
                    <circle className={dot} cx="68" cy="8" r="3.5" />
                    <rect
                        className="fill-skrum-col-moss stroke-skrum-col-moss-border"
                        x="8"
                        y="20"
                        width="30"
                        height="24"
                        rx="4"
                    />
                    <rect
                        className="fill-skrum-col-moss stroke-skrum-col-moss-border"
                        x="8"
                        y="48"
                        width="30"
                        height="24"
                        rx="4"
                    />
                    <rect
                        className="fill-skrum-col-coral stroke-skrum-col-coral-border"
                        x="45"
                        y="20"
                        width="30"
                        height="24"
                        rx="4"
                    />
                    <rect
                        className={dash}
                        x="45"
                        y="48"
                        width="30"
                        height="24"
                        rx="4"
                    />
                    <rect
                        className="fill-skrum-col-sky stroke-skrum-col-sky-border"
                        x="82"
                        y="20"
                        width="30"
                        height="24"
                        rx="4"
                    />
                    <path
                        className={line}
                        d="M14 30 H30 M14 36 H24 M51 30 H67 M88 30 H100"
                    />
                </>
            )}
            {module === 'poker' && (
                <>
                    <g transform="rotate(-14 44 60)">
                        <rect
                            className={card}
                            x="30"
                            y="22"
                            width="30"
                            height="44"
                            rx="5"
                        />
                        <circle className={dot} cx="40" cy="44" r="3" />
                        <circle className={dot} cx="50" cy="44" r="3" />
                    </g>
                    <g transform="rotate(12 76 60)">
                        <rect
                            className={card}
                            x="62"
                            y="22"
                            width="30"
                            height="44"
                            rx="5"
                        />
                        <path className={line} d="M72 38 V52 M72 38 L78 44" />
                    </g>
                    <rect
                        className="fill-primary stroke-none"
                        x="45"
                        y="14"
                        width="30"
                        height="44"
                        rx="5"
                    />
                    <circle
                        className="fill-primary-foreground"
                        cx="55"
                        cy="36"
                        r="3.2"
                    />
                    <circle
                        className="fill-primary-foreground"
                        cx="65"
                        cy="36"
                        r="3.2"
                    />
                    <ellipse
                        className="fill-muted"
                        cx="60"
                        cy="80"
                        rx="36"
                        ry="4"
                    />
                </>
            )}
            {module === 'whiteboard' && (
                <>
                    {[
                        [10, 10],
                        [30, 10],
                        [50, 10],
                        [70, 10],
                        [90, 10],
                        [110, 10],
                        [10, 44],
                        [110, 44],
                        [10, 78],
                        [50, 78],
                        [90, 78],
                        [110, 78],
                    ].map(([cx, cy]) => (
                        <circle
                            key={`${cx}-${cy}`}
                            className="fill-skrum-canvas-dot"
                            cx={cx}
                            cy={cy}
                            r="1.3"
                        />
                    ))}
                    <path
                        className="fill-skrum-col-sun stroke-skrum-col-sun-border"
                        d="M16 22 H46 V46 L40 52 H16 Z"
                    />
                    <path
                        className="fill-skrum-col-lagoon stroke-skrum-col-lagoon-border"
                        d="M74 38 H104 V62 L98 68 H74 Z"
                    />
                    <path className={ink} d="M47 36 C 60 36, 60 52, 72 52" />
                    <path className={ink} d="M67 48 L72 52 L67 56" />
                    <circle className={dot} cx="82" cy="20" r="3.5" />
                    <circle className={dot} cx="96" cy="20" r="3.5" />
                </>
            )}
            {module === 'survey' && (
                <>
                    <rect
                        className={card}
                        x="18"
                        y="8"
                        width="84"
                        height="72"
                        rx="8"
                    />
                    <rect
                        className="fill-primary stroke-none"
                        x="28"
                        y="20"
                        width="10"
                        height="10"
                        rx="3"
                    />
                    <rect
                        className="fill-skrum-col-iris stroke-skrum-col-iris-border"
                        x="44"
                        y="21"
                        width="46"
                        height="8"
                        rx="4"
                    />
                    <rect
                        className={card}
                        x="28"
                        y="39"
                        width="10"
                        height="10"
                        rx="3"
                    />
                    <rect
                        className="fill-skrum-col-iris stroke-skrum-col-iris-border"
                        x="44"
                        y="40"
                        width="30"
                        height="8"
                        rx="4"
                    />
                    <rect
                        className={card}
                        x="28"
                        y="58"
                        width="10"
                        height="10"
                        rx="3"
                    />
                    <rect
                        className="fill-skrum-col-iris stroke-skrum-col-iris-border"
                        x="44"
                        y="59"
                        width="18"
                        height="8"
                        rx="4"
                    />
                    <circle className={dot} cx="88" cy="63" r="3.5" />
                    <circle className={dot} cx="97" cy="63" r="3.5" />
                </>
            )}
            {module === 'icebreaker' && (
                <>
                    <g transform="rotate(-8 40 44)">
                        <rect
                            className="fill-skrum-col-apricot stroke-skrum-col-apricot-border"
                            x="18"
                            y="20"
                            width="44"
                            height="44"
                            rx="8"
                        />
                    </g>
                    <circle
                        className="fill-skrum-col-apricot-text"
                        cx="32"
                        cy="36"
                        r="3.5"
                    />
                    <circle
                        className="fill-skrum-col-apricot-text"
                        cx="46"
                        cy="50"
                        r="3.5"
                    />
                    <g transform="rotate(10 82 44)">
                        <rect
                            className="fill-skrum-col-plum stroke-skrum-col-plum-border"
                            x="60"
                            y="24"
                            width="44"
                            height="44"
                            rx="8"
                        />
                    </g>
                    <circle
                        className="fill-skrum-col-plum-text"
                        cx="74"
                        cy="40"
                        r="3.5"
                    />
                    <circle
                        className="fill-skrum-col-plum-text"
                        cx="88"
                        cy="52"
                        r="3.5"
                    />
                </>
            )}
            {module === 'actions' && (
                <>
                    <path
                        className="fill-skrum-col-moss stroke-skrum-col-moss-border"
                        d="M30 8 H90 V70 L78 82 H30 Z"
                    />
                    <path
                        className="fill-skrum-col-moss-border"
                        d="M90 70 H80 A2 2 0 0 0 78 72 V82 Z"
                    />
                    <rect
                        className={card}
                        x="40"
                        y="22"
                        width="10"
                        height="10"
                        rx="3"
                    />
                    <path className={line} d="M56 27 H80" />
                    <rect
                        className="fill-skrum-success stroke-none"
                        x="40"
                        y="40"
                        width="10"
                        height="10"
                        rx="3"
                    />
                    <path
                        className="fill-none stroke-skrum-success-foreground stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]"
                        d="M42.5 45 L44.5 47 L48 43"
                    />
                    <path className={line} d="M56 45 H74" />
                    <rect
                        className={dash}
                        x="40"
                        y="58"
                        width="10"
                        height="10"
                        rx="3"
                    />
                    <circle className={dot} cx="100" cy="18" r="3.5" />
                    <circle className={dot} cx="110" cy="18" r="3.5" />
                </>
            )}
            {module === 'sessions' && (
                <>
                    <rect
                        className={card}
                        x="14"
                        y="10"
                        width="84"
                        height="20"
                        rx="5"
                    />
                    <rect
                        className="fill-skrum-col-coral stroke-skrum-col-coral-border"
                        x="19"
                        y="14"
                        width="12"
                        height="12"
                        rx="3"
                    />
                    <path className={line} d="M37 20 H76" />
                    <rect
                        className={card}
                        x="14"
                        y="34"
                        width="84"
                        height="20"
                        rx="5"
                    />
                    <rect
                        className="fill-skrum-col-moss stroke-skrum-col-moss-border"
                        x="19"
                        y="38"
                        width="12"
                        height="12"
                        rx="3"
                    />
                    <path className={line} d="M37 44 H66" />
                    <rect
                        className={dash}
                        x="14"
                        y="58"
                        width="84"
                        height="20"
                        rx="5"
                    />
                    <path className={ink} d="M56 63 V73 M51 68 H61" />
                    <circle className={dot} cx="104" cy="12" r="3.5" />
                    <circle className={dot} cx="113" cy="12" r="3.5" />
                </>
            )}
        </svg>
    );
}

export function EmptyState({
    module,
    overline,
    title,
    description,
    illustration = true,
    action,
    secondaryAction,
    headingLevel = 'h2',
    autoFocusAction = false,
    className,
}: EmptyStateProps) {
    const { t } = useTrans();
    const actionRef = useRef<HTMLButtonElement>(null);
    const Heading = headingLevel;
    const ActionIcon = action?.icon;

    useEffect(() => {
        if (autoFocusAction) {
            actionRef.current?.focus();
        }
    }, [autoFocusAction]);

    const actionContent = action && (
        <>
            {ActionIcon && <ActionIcon aria-hidden />}
            <span className="truncate">{action.label}</span>
        </>
    );

    const moduleLabels: Record<EmptyStateModule, string> = {
        retro: t('Retrospective'),
        poker: t('Planning poker'),
        whiteboard: t('Whiteboard'),
        survey: t('Surveys'),
        icebreaker: t('Icebreakers'),
        actions: t('Actions'),
        sessions: t('Sessions'),
    };

    return (
        <section
            data-slot="empty-state"
            data-module={module}
            className={cn(
                'mx-auto flex w-full max-w-md min-w-0 flex-col items-center gap-3 px-5 py-8 text-center',
                className,
            )}
        >
            {illustration && <Illustration module={module} />}
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {overline ?? moduleLabels[module]}
            </span>
            <Heading
                data-slot="empty-state-title"
                className="font-display text-lg font-bold text-balance"
            >
                {title}
            </Heading>
            <p
                data-slot="empty-state-description"
                className="line-clamp-2 text-sm text-balance text-muted-foreground"
            >
                {description}
            </p>
            {(action || secondaryAction) && (
                <div className="mt-2 flex max-w-full flex-wrap items-center justify-center gap-2">
                    {action && (
                        <Button
                            ref={actionRef}
                            variant={action.variant ?? 'default'}
                            asChild={action.href !== undefined}
                            onClick={action.onClick}
                            className="max-w-full"
                        >
                            {action.href !== undefined ? (
                                <Link href={action.href}>{actionContent}</Link>
                            ) : (
                                actionContent
                            )}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="outline"
                            asChild={secondaryAction.href !== undefined}
                            onClick={secondaryAction.onClick}
                            className="max-w-full"
                        >
                            {secondaryAction.href !== undefined ? (
                                <Link href={secondaryAction.href}>
                                    <span className="truncate">
                                        {secondaryAction.label}
                                    </span>
                                </Link>
                            ) : (
                                <span className="truncate">
                                    {secondaryAction.label}
                                </span>
                            )}
                        </Button>
                    )}
                </div>
            )}
        </section>
    );
}
